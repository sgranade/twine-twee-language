import { Diagnostic, Location, Range } from "vscode-languageserver";

/**
 * Corresponds to the Twee 3 StoryData passage.
 */
export interface StoryData {
    ifid: string;
    format?: string;
    formatVersion?: string;
    start?: string;
    tagColors?: Map<string, string>;
    zoom?: number;
}

export interface PassageMetadata {
    position?: string;
    size?: string;
}

/**
 * A Twee 3 passage.
 */
export interface Passage {
    name: string;
    location: Location;
    isScript: boolean;
    isStylesheet: boolean;
    tags?: string[];
    metadata?: PassageMetadata;
    varsSection?: Range; // Chapbook variables section
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
     * Set the list of errors that occured during parsing.
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
     * Get the list of passages in a document, if indexed.
     * @param uri URI to document.
     */
    getPassages(uri: string): Passage[] | undefined;
    /**
     * Get the parse errors.
     * @param uri Scene document URI.
     */
    getParseErrors(uri: string): ReadonlyArray<Diagnostic>;
    /**
     * Get all passage names in the index.
     */
    getPassageNames(): Set<string>;
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
    private _passages: Map<string, Passage[]>;
    private _parseErrors: Map<string, Diagnostic[]>;

    constructor() {
        this._passages = new Map();
        this._parseErrors = new Map();
    }
    setStoryTitle(title: string, uri: string): void {
        this._storyTitle = title;
        this._storyTitleUri = uri;
    }
    setStoryData(data: StoryData, uri: string): void {
        this._storyData = data;
        this._storyDataUri = uri;
    }
    setPassages(uri: string, newPassages: Passage[]): void {
        this._passages.set(uri, [...newPassages]);
    }
    setParseErrors(uri: string, errors: Diagnostic[]): void {
        this._parseErrors.set(uri, [...errors]);
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
        return this._passages.get(uri);
    }
    getParseErrors(uri: string): ReadonlyArray<Diagnostic> {
        const errors = this._parseErrors.get(uri) ?? [];
        return errors;
    }
    getPassageNames(): Set<string> {
        const s = new Set<string>();

        for (const passages of this._passages.values()) {
            passages.map((p) => p.name).forEach(s.add, s);
        }

        return s;
    }
    removeDocument(uri: string): void {
        this._passages.delete(uri);
        this._parseErrors.delete(uri);
        if (uri === this._storyTitleUri) {
            this._storyTitle = undefined;
        }
        if (uri === this._storyDataUri) {
            this._storyData = undefined;
        }
    }
}
