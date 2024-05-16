import { Diagnostic, Location, Range } from "vscode-languageserver";

import { StoryFormat } from "./client-server";
import { EmbeddedDocument } from "./embedded-languages";
import { Token } from "./tokens";
import { normalizeUri } from "./utilities";

/**
 * A label, which has a name and a location.
 */
export interface Label {
    contents: string;
    location: Location;
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
     * @param uri URI to document whose index is to be updated.
     * @param newPassages New index of labels.
     */
    setPassages(uri: string, newPassages: Passage[]): void;
    /**
     * Set references to a passage in a document.
     * @param uri URI to document whose index is to be updated.
     * @param newPassages New index of references to passages.
     */
    setPassageReferences(
        uri: string,
        newReferences: Record<string, Range[]>
    ): void;
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
    getPassageReferences(uri: string): Record<string, Range[]> | undefined;
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
     * Get all passage names in the index.
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
    private _passageReferences: Record<string, Record<string, Range[]>> = {};
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
    setPassageReferences(
        uri: string,
        newReferences: Record<string, Range[]>
    ): void {
        uri = normalizeUri(uri);
        this._passageReferences[uri] = newReferences;
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
    getPassageReferences(uri: string): Record<string, Range[]> | undefined {
        uri = normalizeUri(uri);
        return this._passageReferences[uri];
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
    getPassageNames(): readonly string[] {
        const s = new Set<string>();

        for (const passages of Object.values(this._passages)) {
            passages.forEach((p) => s.add(p.name.contents));
        }

        return [...s];
    }
    removeDocument(uri: string): void {
        uri = normalizeUri(uri);
        delete this._passages[uri];
        delete this._passageReferences[uri];
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
