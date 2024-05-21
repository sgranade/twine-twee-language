import { Diagnostic, Location, Position, Range } from "vscode-languageserver";

import { StoryFormat } from "./client-server";
import { EmbeddedDocument } from "./embedded-languages";
import { Token } from "./tokens";
import { normalizeUri, positionInRange } from "./utilities";

/**
 * A label, which has a name and a location.
 */
export interface Label {
    contents: string;
    location: Location;
}

/**
 * References, which have a name and locations.
 */
export interface References {
    contents: string;
    locations: Location[];
}

interface TwineSymbol extends Label {
    kind: TwineSymbolKind;
}

/**
 * Kind of a Twine symbol.
 */
export enum TwineSymbolKind {
    Passage = 0,
}

/**
 * References inside a document. A mapping of symbol names to ranges in a document.
 */
type LocalReferences = Record<string, Range[]>;
/**
 * References per symbol type in a document. A mapping of symbol kind to local references.
 */
type LocalReferencesPerType = Record<number, LocalReferences>;
/**
 * References per document. A mapping of URIs to local references per type.
 */
type DocumentReferences = Record<string, LocalReferencesPerType>;

/**
 * Corresponds to the Twee 3 StoryData passage.
 */
export interface StoryData {
    ifid: string;
    storyFormat?: StoryFormat;
    start?: string;
    tagColors?: Record<string, string>;
    zoom?: number;
}

/**
 * A Twee 3 passage.
 */
export interface Passage {
    name: Label;
    scope: Range;
    isScript: boolean;
    isStylesheet: boolean;
    tags?: Label[];
    metadata?: PassageMetadata;
}

/**
 * Metadata associated with a Twee 3 passage.
 */
export interface PassageMetadata {
    raw: Label;
    position?: string;
    size?: string;
}

/**
 * Index for a Twee 3 project.
 */
export interface ProjectIndex {
    /**
     * Set the project's story title.
     * @param title Story title.
     * @param uri URI of the document that holds the story title.
     */
    setStoryTitle(title: string, uri: string): void;
    /**
     * Set the project's story data.
     * @param data Story data.
     * @param uri URI of the document that holds the story data.
     */
    setStoryData(data: StoryData, uri: string): void;
    /**
     * Set the list of passages in a document.
     * @param uri URI to document whose index is to be updated.
     * @param newPassages New index of labels.
     */
    setPassages(uri: string, newPassages: Passage[]): void;
    /**
     * Set references to a passage in a document.
     * @param uri URI to document whose index is to be updated.
     * @param newPassages New index of references to passages.
     */
    setPassageReferences(uri: string, newReferences: LocalReferences): void;
    /**
     * Set a document's list of embedded documents.
     * @param uri URI to document whose index is to be updated.
     * @param errors New list of embedded documents.
     */
    setEmbeddedDocuments(uri: string, documents: EmbeddedDocument[]): void;
    /**
     * Set a document's semantic tokens.
     * @param uri URI to document whose index is to be updated.
     * @param tokens New list of semantic tokens.
     */
    setTokens(uri: string, tokens: Token[]): void;
    /**
     * Set a document's list of errors that occured during parsing.
     * @param uri URI to document whose index is to be updated.
     * @param errors New list of errors.
     */
    setParseErrors(uri: string, errors: Diagnostic[]): void;

    /**
     * Get the project's story title, if known.
     */
    getStoryTitle(): string | undefined;
    /**
     * Get the URI where the project's story title lives, if known.
     */
    getStoryTitleUri(): string | undefined;
    /**
     * Get the project's story data, if known.
     */
    getStoryData(): StoryData | undefined;
    /**
     * Get the URI where the project's story title lives, if known.
     */
    getStoryDataUri(): string | undefined;
    /**
     * Get a document's list of passages, if indexed.
     * @param uri Document URI.
     */
    getPassages(uri: string): Passage[] | undefined;
    /**
     * Get a document's references to passages, if indexed.
     * @param uri Document URI.
     */
    getPassageReferences(uri: string): LocalReferences | undefined;
    /**
     * Get a document's list of embedded documents.
     * @param uri Document URI.
     */
    getEmbeddedDocuments(uri: string): EmbeddedDocument[] | undefined;
    /**
     * Get a document's semantic tokens.
     * @param uri Document URI.
     */
    getTokens(uri: string): readonly Token[];
    /**
     * Get a document's parse errors.
     * @param uri Document URI.
     */
    getParseErrors(uri: string): readonly Diagnostic[];

    /**
     * Find the location of an indexed symbol by that symbol's name.
     * @param name Symbol name.
     * @param kind Kind of symbol.
     * @returns Symbol's location, or undefined if not found.
     */
    getSymbolLocation(
        name: string,
        kind: TwineSymbolKind
    ): Location | undefined;
    /**
     * Get the indexed symbol (if any) at a location in a document.
     * @param uri Document URI.
     * @param position Position.
     * @returns Symbol, or undefined if not found.
     */
    getSymbolAt(uri: string, position: Position): TwineSymbol | undefined;
    /**
     * Get the location of a symbol's definition based on a symbol or single reference at a location in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     */
    getDefinitionAt(uri: string, position: Position): TwineSymbol | undefined;
    /**
     * Get all references to a symbol based on a symbol or single reference in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     * @param includeDeclaration True if the symbol declaration should be included as a reference.
     */
    getReferencesAt(
        uri: string,
        position: Position,
        includeDeclaration: boolean
    ): References | undefined;
    /**
     * Get a passage by name.
     * @param name Name of the passage to find.
     * @returns Passages (which may be more than one if they all have the same name), if found.
     */
    getPassage(name: string): Passage[];
    /**
     * Get all passage names in the index.
     *
     * There may be duplicated names if multiple passages share the same name.
     */
    getPassageNames(): readonly string[];

    /**
     * Remove a document from the project index.
     * @param uri URI of document to remove.
     */
    removeDocument(uri: string): void;
}

/**
 * Instantiable index class
 */
export class Index implements ProjectIndex {
    private _storyTitle?: string;
    private _storyTitleUri?: string;
    private _storyData?: StoryData;
    private _storyDataUri?: string;
    private _passages: Record<string, Passage[]> = {};
    private _references: DocumentReferences = {};
    private _embeddedDocuments: Record<string, EmbeddedDocument[]> = {};
    private _tokens: Record<string, Token[]> = {};
    private _parseErrors: Record<string, Diagnostic[]> = {};

    setStoryTitle(title: string, uri: string): void {
        uri = normalizeUri(uri);
        this._storyTitle = title;
        this._storyTitleUri = uri;
    }
    setStoryData(data: StoryData, uri: string): void {
        uri = normalizeUri(uri);
        this._storyData = data;
        this._storyDataUri = uri;
    }
    setPassages(uri: string, newPassages: Passage[]): void {
        uri = normalizeUri(uri);
        this._passages[uri] = [...newPassages];
    }
    setPassageReferences(uri: string, newReferences: LocalReferences): void {
        uri = normalizeUri(uri);
        if (this._references[uri] === undefined) {
            this._references[uri] = {};
        }
        this._references[uri][TwineSymbolKind.Passage] = newReferences;
    }
    setEmbeddedDocuments(uri: string, documents: EmbeddedDocument[]): void {
        uri = normalizeUri(uri);
        this._embeddedDocuments[uri] = [...documents];
    }
    setTokens(uri: string, tokens: Token[]): void {
        uri = normalizeUri(uri);
        this._tokens[uri] = [...tokens];
    }
    setParseErrors(uri: string, errors: Diagnostic[]): void {
        uri = normalizeUri(uri);
        this._parseErrors[uri] = [...errors];
    }
    getStoryTitle(): string | undefined {
        return this._storyTitle;
    }
    getStoryTitleUri(): string | undefined {
        return this._storyTitleUri;
    }
    getStoryData(): StoryData | undefined {
        return this._storyData;
    }
    getStoryDataUri(): string | undefined {
        return this._storyDataUri;
    }
    getPassages(uri: string): Passage[] | undefined {
        uri = normalizeUri(uri);
        return this._passages[uri];
    }
    getPassageReferences(uri: string): LocalReferences | undefined {
        uri = normalizeUri(uri);
        const documentReferences = this._references[uri];
        if (documentReferences !== undefined)
            return documentReferences[TwineSymbolKind.Passage];
        return undefined;
    }
    getEmbeddedDocuments(uri: string): EmbeddedDocument[] {
        uri = normalizeUri(uri);
        return this._embeddedDocuments[uri] ?? [];
    }
    getTokens(uri: string): readonly Token[] {
        uri = normalizeUri(uri);
        return this._tokens[uri] ?? [];
    }
    getParseErrors(uri: string): readonly Diagnostic[] {
        uri = normalizeUri(uri);
        return this._parseErrors[uri] ?? [];
    }

    getSymbolLocation(
        name: string,
        kind: TwineSymbolKind
    ): Location | undefined {
        if (kind === TwineSymbolKind.Passage) {
            for (const passages of Object.values(this._passages)) {
                const match = passages.find((p) => p.name.contents === name);
                if (match !== undefined) {
                    return match.name.location;
                }
            }
        }

        return undefined;
    }
    getSymbolAt(uri: string, position: Position): TwineSymbol | undefined {
        // See if the index has a passage name here
        const passage = this.getPassages(uri)?.find((p) =>
            positionInRange(position, p.name.location.range)
        );
        if (passage !== undefined) {
            return {
                contents: passage.name.contents,
                location: passage.name.location,
                kind: TwineSymbolKind.Passage,
            };
        }

        return undefined;
    }
    getDefinitionAt(uri: string, position: Position): TwineSymbol | undefined {
        uri = normalizeUri(uri);

        // Do we have a reference at the position?
        const referencesPerType = this._references[uri] || {};
        for (const [symbolTypeAsString, localReferences] of Object.entries(
            referencesPerType
        )) {
            for (const [name, locations] of Object.entries(localReferences)) {
                const match = locations.find((loc) =>
                    positionInRange(position, loc)
                );

                // If we do have a reference, see if we have a matching symbol
                if (match !== undefined) {
                    const symbolType = Number(symbolTypeAsString);
                    const symbolLocation = this.getSymbolLocation(
                        name,
                        symbolType
                    );
                    if (symbolLocation !== undefined) {
                        return {
                            contents: name,
                            location: symbolLocation,
                            kind: symbolType,
                        };
                    }
                }
            }
        }

        // If we don't have a reference, do we have a symbol at the position?
        const symbol = this.getSymbolAt(uri, position);
        return symbol;
    }
    getReferencesAt(
        uri: string,
        position: Position,
        includeReferences: boolean
    ): References | undefined {
        // First, see if we can get to a definition at the position
        const symbol = this.getDefinitionAt(uri, position);
        if (symbol === undefined) return undefined;

        // Next, scan through all document references to find this symbol's specific references.
        const references: References = {
            contents: symbol.contents,
            locations: [],
        };
        for (const [refUri, localReferencesPerType] of Object.entries(
            this._references
        )) {
            const localReferences = localReferencesPerType[symbol.kind];
            if (localReferences !== undefined) {
                const locs = localReferences[symbol.contents];
                if (locs !== undefined) {
                    for (const range of locs) {
                        references.locations.push(
                            Location.create(refUri, range)
                        );
                    }
                }
            }
        }

        if (includeReferences) {
            references.locations.push(symbol.location);
        }

        return references;
    }
    getPassage(name: string): Passage[] {
        const matches: Passage[] = [];
        for (const passages of Object.values(this._passages)) {
            matches.push(...passages.filter((p) => p.name.contents === name));
        }
        return matches;
    }
    getPassageNames(): readonly string[] {
        const s = [];

        for (const passages of Object.values(this._passages)) {
            s.push(...passages.map((p) => p.name.contents));
        }

        return s;
    }

    removeDocument(uri: string): void {
        uri = normalizeUri(uri);
        delete this._passages[uri];
        delete this._references[uri];
        delete this._embeddedDocuments[uri];
        delete this._tokens[uri];
        delete this._parseErrors[uri];
        if (uri === this._storyTitleUri) {
            this._storyTitle = undefined;
        }
        if (uri === this._storyDataUri) {
            this._storyData = undefined;
        }
    }
}
