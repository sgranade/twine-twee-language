import { Location, Range } from 'vscode-languageserver';

/**
 * Corresponds to the Twee 3 StoryData passage.
 */
export interface StoryData {
	ifid: string,
	format: string,
	formatVersion?: string,
	start?: string,
	tagColors?: Map<string, string>,
	zoom?: number
}

export interface PassageMetadata {
	position?: string,
	size?: string
}

/**
 * A Twee 3 passage.
 */
export interface Passage {
	name: string,
	location: Location,
	isScript: boolean,
	isStylesheet: boolean,
	tags?: string[],
	metadata?: PassageMetadata,
	varsSection?: Range // Chapbook variables section
}

/**
 * Index for a Twee 3 project.
 */
export interface ProjectIndex {
	/**
	 * Set the project's story data.
	 * @param data Story data.
	 * @param sourceUri URI of the document that holds the story data.
	 */
	setStoryData(data: StoryData, sourceUri: string): void;
	/**
	 * Set the list of passages in a document.
	 * @param uri URI to document whose index is to be updated.
	 * @param newPassages New index of labels.
	 */
	setPassages(uri: string, newPassages: Passage[]): void;
	/**
	 * Get the project's story data, if known.
	 */
	getStoryData(): StoryData | undefined;
	/**
	 * Get the list of passages in a document, if indexed.
	 * @param uri URI to document.
	 */
	getPassages(uri: string): Passage[] | undefined;
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
	private _storyData?: StoryData;
	private _storyDataUri?: string;
	private _passages: Map<string, Passage[]>;

	constructor() {
		this._passages = new Map();
	}
	setStoryData(data: StoryData, sourceUri: string): void {
		this._storyData = data;
		this._storyDataUri = sourceUri;
	}
	setPassages(uri: string, newPassages: Passage[]): void {
		this._passages.set(uri, [...newPassages]);
	}
	getStoryData(): StoryData | undefined {
		return this._storyData;
	}
	getPassages(uri: string): Passage[] | undefined {
		return this._passages.get(uri);
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
		if (uri == this._storyDataUri) {
			this._storyData = undefined;
		}
	}
}
