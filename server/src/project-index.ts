import { Diagnostic, Location, Position, Range } from "vscode-languageserver";

import { StoryFormat } from "./client-server";
import { EmbeddedDocument } from "./embedded-languages";
import { SemanticToken } from "./tokens";
import { positionInRange } from "./utilities";

/**
 * A number that identifies the kind of a symbol or reference.
 */
export interface Kind {
    kind: number;
}

/**
 * A label, which has a name and a location.
 */
export interface Label {
    contents: string;
    location: Location;
}

/**
 * A label with a number that identifies the kind of label it is.
 */
export interface Symbol extends Label, Kind {}

/**
 * Kind of a Twine symbol.
 */
export enum TwineSymbolKind {
    Passage = 1,
    _end, // So story-format parsers can de-conflict their values
}

/**
 * References, which have contents, locations, and an identifier for its kind.
 */
export interface References extends Kind {
    contents: string;
    locations: Location[];
}

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
     * @param uri URI of the document whose index is to be updated.
     * @param passages New list of passages.
     */
    setPassages(uri: string, passages: Passage[]): void;
    /**
     * Set symbol definitions in a document.
     * @param uri URI of the document whose index is to be updated.
     * @param definitions New list of symbols.
     */
    setDefinitions(uri: string, definitions: Symbol[]): void;
    /**
     * Set references to symbols in a document.
     * @param uri URI of the document whose index is to be updated.
     * @param newPassages New list of references.
     */
    setReferences(uri: string, references: References[]): void;
    /**
     * Set a document's list of embedded documents.
     * @param uri URI of the document whose index is to be updated.
     * @param errors New list of embedded documents.
     */
    setEmbeddedDocuments(uri: string, documents: EmbeddedDocument[]): void;
    /**
     * Set a document's semantic tokens.
     * @param uri URI of the document whose index is to be updated.
     * @param tokens New list of semantic tokens.
     */
    setSemanticTokens(uri: string, tokens: SemanticToken[]): void;
    /**
     * Set a document's list of errors that occured during parsing.
     * @param uri URI of the document whose index is to be updated.
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
     * Get a document's definitions, if indexed.
     * @param uri Document URI.
     * @param kind Kind of symbol definitions to get.
     */
    getDefinitions(uri: string, kind: number): Symbol[] | undefined;
    /**
     * Get a document's references, if indexed.
     * @param uri Document URI.
     * @param kind Kind of symbol reference to get.
     */
    getReferences(uri: string, kind: number): References[] | undefined;
    /**
     * Get a document's list of embedded documents.
     * @param uri Document URI.
     */
    getEmbeddedDocuments(uri: string): EmbeddedDocument[] | undefined;
    /**
     * Get a document's semantic tokens.
     * @param uri Document URI.
     */
    getSemanticTokens(uri: string): readonly SemanticToken[];
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
    getSymbolAt(uri: string, position: Position): Symbol | undefined;
    /**
     * Get the location of a symbol's definition based on a symbol or single reference at a location in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     */
    getDefinitionAt(uri: string, position: Position): Symbol | undefined;
    /**
     * Get all references to a symbol based on a symbol or single reference in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     * @param includeDeclaration True if the symbol declaration should be included as a reference.
     * @returns The references, if there is a symbol with references at the position.
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
     * Get all URIs in the index.
     */
    getIndexedUris(): readonly string[];

    /**
     * Remove a document from the project index.
     * @param uri URI of document to remove.
     */
    removeDocument(uri: string): void;
}

type RepositoryPerKind<T> = Record<number, T[]>;

/**
 * Instantiable index class
 */
export class Index implements ProjectIndex {
    private _storyTitle?: string;
    private _storyTitleUri?: string;
    private _storyData?: StoryData;
    private _storyDataUri?: string;
    private _passages: Record<string, Passage[]> = {};
    private _definitions: Record<string, RepositoryPerKind<Symbol>> = {};
    private _references: Record<string, RepositoryPerKind<References>> = {};
    private _embeddedDocuments: Record<string, EmbeddedDocument[]> = {};
    private _semanticTokens: Record<string, SemanticToken[]> = {};
    private _parseErrors: Record<string, Diagnostic[]> = {};

    setStoryTitle(title: string, uri: string): void {
        this._storyTitle = title;
        this._storyTitleUri = uri;
    }
    setStoryData(data: StoryData, uri: string): void {
        this._storyData = data;
        this._storyDataUri = uri;
    }
    setPassages(uri: string, newPassages: Passage[]): void {
        this._passages[uri] = [...newPassages];
    }
    _setPerKind<T extends Kind>(toAdd: T[]): RepositoryPerKind<T> {
        const repo: RepositoryPerKind<T> = {};
        for (const item of toAdd) {
            const list = repo[item.kind] || [];
            list.push(item);
            repo[item.kind] = list;
        }
        return repo;
    }
    setDefinitions(uri: string, definitions: Symbol[]): void {
        this._definitions[uri] = this._setPerKind(definitions);
    }
    setReferences(uri: string, references: References[]): void {
        this._references[uri] = this._setPerKind(references);
    }
    setEmbeddedDocuments(uri: string, documents: EmbeddedDocument[]): void {
        this._embeddedDocuments[uri] = [...documents];
    }
    setSemanticTokens(uri: string, tokens: SemanticToken[]): void {
        this._semanticTokens[uri] = [...tokens];
    }
    setParseErrors(uri: string, errors: Diagnostic[]): void {
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
        return this._passages[uri];
    }
    getDefinitions(uri: string, kind: number): Symbol[] | undefined {
        const definitionsPerSymbolKind = this._definitions[uri];
        if (definitionsPerSymbolKind !== undefined) {
            return definitionsPerSymbolKind[kind];
        }
        return undefined;
    }
    getReferences(uri: string, kind: number): References[] | undefined {
        const referencesPerSymbolKind = this._references[uri];
        if (referencesPerSymbolKind !== undefined) {
            return referencesPerSymbolKind[kind];
        }
        return undefined;
    }
    getEmbeddedDocuments(uri: string): EmbeddedDocument[] {
        return this._embeddedDocuments[uri] ?? [];
    }
    getSemanticTokens(uri: string): readonly SemanticToken[] {
        return this._semanticTokens[uri] ?? [];
    }
    getParseErrors(uri: string): readonly Diagnostic[] {
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
    getSymbolAt(uri: string, position: Position): Symbol | undefined {
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
    getDefinitionAt(uri: string, position: Position): Symbol | undefined {
        // Do we have a reference at the position?
        const referencesPerKind = this._references[uri] || {};
        for (const [symbolKindAsString, localReferences] of Object.entries(
            referencesPerKind
        )) {
            for (const ref of localReferences) {
                const match = ref.locations.find((loc) =>
                    positionInRange(position, loc.range)
                );

                // If we do have a reference, see if we have a matching symbol
                if (match !== undefined) {
                    const symbolType = Number(symbolKindAsString);
                    const symbolLocation = this.getSymbolLocation(
                        ref.contents,
                        symbolType
                    );
                    if (symbolLocation !== undefined) {
                        return {
                            contents: ref.contents,
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
        includeDeclaration: boolean
    ): References | undefined {
        // First, see if we can get to a definition at the position
        const symbol = this.getDefinitionAt(uri, position);
        if (symbol === undefined) return undefined;

        // Next, scan through all document references to find this symbol's specific references.
        const references: References = {
            contents: symbol.contents,
            locations: [],
            kind: symbol.kind,
        };
        for (const [refUri, localReferencesPerType] of Object.entries(
            this._references
        )) {
            const localReferences = localReferencesPerType[symbol.kind];
            if (localReferences !== undefined) {
                const ref = localReferences.find(
                    (ref) => ref.contents === symbol.contents
                );
                if (ref !== undefined) {
                    for (const loc of ref.locations) {
                        references.locations.push(loc);
                    }
                }
            }
        }

        if (includeDeclaration) {
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

    getIndexedUris(): readonly string[] {
        const s = new Set([
            ...Object.keys(this._passages),
            ...Object.keys(this._definitions),
            ...Object.keys(this._references),
            ...Object.keys(this._embeddedDocuments),
            ...Object.keys(this._semanticTokens),
            ...Object.keys(this._parseErrors),
        ]);
        return [...s];
    }

    removeDocument(uri: string): void {
        delete this._passages[uri];
        delete this._definitions[uri];
        delete this._references[uri];
        delete this._embeddedDocuments[uri];
        delete this._semanticTokens[uri];
        delete this._parseErrors[uri];
        if (uri === this._storyTitleUri) {
            this._storyTitle = undefined;
        }
        if (uri === this._storyDataUri) {
            this._storyData = undefined;
        }
    }
}
