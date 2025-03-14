import { Diagnostic, Location, Position, Range } from "vscode-languageserver";

import { DecorationRange, StoryFormat } from "./client-server";
import { EmbeddedDocument } from "./embedded-languages";
import { SemanticToken } from "./semantic-tokens";
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
export interface ProjSymbol extends Label, Kind {}

/**
 * Kind of a Twine symbol.
 */
export enum TwineSymbolKind {
    Passage = 1,
    _end, // So story format parsers can de-conflict their values
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
    // When parsed, scope includes the entire passage contents
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
    setDefinitions(uri: string, definitions: ProjSymbol[]): void;
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
     * Set a document's list of folding ranges.
     * @param uri URI of the document whose index is to be updated.
     * @param ranges Folding ranges in the document.
     */
    setFoldingRanges(uri: string, ranges: Range[]): void;
    /**
     * Set a document's list of decoration ranges.
     * @param uri URI of the document whose index is to be updated.
     * @param ranges Decoration ranges in the document.
     */
    setDecorationRanges(uri: string, ranges: DecorationRange[]): void;
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
    getDefinitions(uri: string, kind: number): ProjSymbol[] | undefined;
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
     * Get a document's folding ranges.
     * @param uri Document URI.
     */
    getFoldingRanges(uri: string): readonly Range[];
    /**
     * Get a document's decoration ranges.
     * @param uri Document URI.
     */
    getDecorationRanges(uri: string): readonly DecorationRange[];
    /**
     * Get a document's parse errors.
     * @param uri Document URI.
     */
    getParseErrors(uri: string): readonly Diagnostic[];

    /**
     * Find the definition of an indexed symbol by that symbol's name and kind.
     * @param name Symbol name.
     * @param kind Kind of symbol.
     * @returns Symbol's location, or undefined if not found.
     */
    getSymbolDefinitionByName(
        name: string,
        kind: TwineSymbolKind
    ): Location | undefined;
    /**
     * Get the symbol definition (if any) at a location in a document.
     * @param uri Document URI.
     * @param position Position in the document.
     * @returns Symbol, or undefined if none is found.
     */
    getDefinitionAt(uri: string, position: Position): ProjSymbol | undefined;
    /**
     * Get the symbol reference at a location in a document.
     * @param uri Document URI.
     * @param position Position in the document.
     * @returns References at that location, or undefined if none are found.
     */
    getReferencesAt(uri: string, position: Position): References | undefined;
    /**
     * Get the location of a symbol's definition based on a symbol or single reference at a location in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     */
    getDefinitionBySymbolAt(
        uri: string,
        position: Position
    ): ProjSymbol | undefined;
    /**
     * Get all references to a symbol based on a symbol or single reference in a document.
     * @param uri Document URI.
     * @param position Position in the document where the symbol or symbol reference should be.
     * @param includeDeclaration True if the symbol declaration should be included as a reference.
     * @returns The references, if there is a symbol with references at the position.
     */
    getReferencesToSymbolAt(
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
     * Get a passage at a location.
     * @param uri Document URI.
     * @param position Position in the document.
     * @returns The passage that contains the position, or undefined if there is none at that location.
     */
    getPassageAt(uri: string, position: Position): Passage | undefined;
    /**
     * Get all passage names in the index in alphabetically- sorted order.
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
    private _definitions: Record<string, RepositoryPerKind<ProjSymbol>> = {};
    private _references: Record<string, RepositoryPerKind<References>> = {};
    private _embeddedDocuments: Record<string, EmbeddedDocument[]> = {};
    private _semanticTokens: Record<string, SemanticToken[]> = {};
    private _foldingRanges: Record<string, Range[]> = {};
    private _decorationRanges: Record<string, DecorationRange[]> = {};
    private _parseErrors: Record<string, Diagnostic[]> = {};

    // Cache of passage names
    private _cachedPassageNames: string[] | undefined = undefined;

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
        this._cachedPassageNames = undefined;
    }
    _setPerKind<T extends Kind>(toAdd: T[]): RepositoryPerKind<T> {
        const repo: RepositoryPerKind<T> = {};
        for (const item of toAdd) {
            const list = repo[item.kind] ?? [];
            list.push(item);
            repo[item.kind] = list;
        }
        return repo;
    }
    setDefinitions(uri: string, definitions: ProjSymbol[]): void {
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
    setFoldingRanges(uri: string, ranges: Range[]): void {
        this._foldingRanges[uri] = [...ranges];
    }
    setDecorationRanges(uri: string, ranges: DecorationRange[]): void {
        this._decorationRanges[uri] = [...ranges];
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
    getDefinitions(uri: string, kind: number): ProjSymbol[] | undefined {
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
    getFoldingRanges(uri: string): readonly Range[] {
        return this._foldingRanges[uri] ?? [];
    }
    getDecorationRanges(uri: string): readonly DecorationRange[] {
        return this._decorationRanges[uri] ?? [];
    }
    getParseErrors(uri: string): readonly Diagnostic[] {
        return this._parseErrors[uri] ?? [];
    }

    getSymbolDefinitionByName(
        name: string,
        kind: number
    ): Location | undefined {
        // Special case passages, since they're not stored as definitions
        if (kind === TwineSymbolKind.Passage) {
            for (const passages of Object.values(this._passages)) {
                const match = passages.find((p) => p.name.contents === name);
                if (match !== undefined) {
                    return match.name.location;
                }
            }
        }

        for (const defsPerKind of Object.values(this._definitions)) {
            const defs = defsPerKind[kind] ?? [];
            const match = defs.find((d) => d.contents === name);
            if (match !== undefined) {
                return match.location;
            }
        }

        return undefined;
    }
    getDefinitionAt(uri: string, position: Position): ProjSymbol | undefined {
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

        // Check our other definitions
        const definitionsPerKind = this._definitions[uri] ?? {};
        for (const defs of Object.values(definitionsPerKind)) {
            const match = defs.find((def) =>
                positionInRange(position, def.location.range)
            );
            if (match !== undefined) {
                return match;
            }
        }

        return undefined;
    }
    getReferencesAt(uri: string, position: Position): References | undefined {
        // Do we have a reference at the position?
        const referencesPerKind = this._references[uri] ?? {};
        for (const localReferences of Object.values(referencesPerKind)) {
            for (const ref of localReferences) {
                const match = ref.locations.find((loc) =>
                    positionInRange(position, loc.range)
                );
                if (match !== undefined) {
                    return ref;
                }
            }
        }
        return undefined;
    }
    getDefinitionBySymbolAt(
        uri: string,
        position: Position
    ): ProjSymbol | undefined {
        // Do we have a reference at the position?
        const ref = this.getReferencesAt(uri, position);
        if (ref !== undefined) {
            // See if we have a matching symbol for this reference
            const symbolLocation = this.getSymbolDefinitionByName(
                ref.contents,
                ref.kind
            );
            if (symbolLocation !== undefined) {
                return {
                    contents: ref.contents,
                    location: symbolLocation,
                    kind: ref.kind,
                };
            }
        }

        // If we don't have a reference, do we have a symbol at the position?
        const symbol = this.getDefinitionAt(uri, position);
        return symbol;
    }
    getReferencesToSymbolAt(
        uri: string,
        position: Position,
        includeDeclaration: boolean
    ): References | undefined {
        const references: References = {
            contents: "placeholder",
            locations: [],
            kind: 0,
        };

        // See if there's a reference at this position
        const initialReferences = this.getReferencesAt(uri, position);
        if (initialReferences !== undefined) {
            references.contents = initialReferences.contents;
            references.kind = initialReferences.kind;
        } else {
            // If there are no references, is there a definition?
            const symbolDefinition = this.getDefinitionAt(uri, position);
            if (symbolDefinition !== undefined) {
                references.contents = symbolDefinition.contents;
                references.kind = symbolDefinition.kind;
            } else return undefined;
        }

        // Next, scan through all document references to find additional reference locations
        for (const referencesPerKind of Object.values(this._references)) {
            const localReferences = referencesPerKind[references.kind];
            if (localReferences !== undefined) {
                const ref = localReferences.find(
                    (ref) => ref.contents === references.contents
                );
                if (ref !== undefined) {
                    references.locations.push(...ref.locations);
                }
            }
        }

        // Finally, if we need the definition, find and include it
        if (includeDeclaration) {
            const symbolDefinitionLocation = this.getSymbolDefinitionByName(
                references.contents,
                references.kind
            );
            if (symbolDefinitionLocation !== undefined) {
                references.locations.push(symbolDefinitionLocation);
            }
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
    getPassageAt(uri: string, position: Position): Passage | undefined {
        for (const passage of this._passages[uri] ?? []) {
            if (positionInRange(position, passage.scope)) {
                return passage;
            }
        }
        return undefined;
    }
    getPassageNames(): string[] {
        // Since passage name generation can take significant time
        // for large projects, cache the results
        if (this._cachedPassageNames === undefined) {
            this._cachedPassageNames = [];
            for (const passages of Object.values(this._passages)) {
                this._cachedPassageNames.push(
                    ...passages.map((p) => p.name.contents)
                );
            }
            this._cachedPassageNames.sort();
        }
        return this._cachedPassageNames;
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
        delete this._foldingRanges[uri];
        delete this._decorationRanges[uri];
        delete this._parseErrors[uri];
        if (uri === this._storyTitleUri) {
            this._storyTitle = undefined;
        }
        if (uri === this._storyDataUri) {
            this._storyData = undefined;
        }
        this._cachedPassageNames = undefined;
    }
}
