import { StoryFormat } from "../client-server";

/**
 * A Twine story.
 */
export interface Story {
    /**
     * The story's name (title).
     */
    name?: string;
    /**
     * Story metadata.
     */
    storyData?: StoryData;
    /**
     * All of the passages in the story.
     */
    passages: Passage[];
}

/**
 * Corresponds to info in the Twee 3 StoryData passage.
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
    name: string;
    /**
     * Is the passage a JavaScript passage?
     */
    isScript: boolean;
    /**
     * Is the passage a CSS stylesheet passage?
     */
    isStylesheet: boolean;
    /**
     * Passage's Twee tags.
     */
    tags?: string[];
    /**
     * Passage's metadata.
     */
    metadata?: PassageMetadata;
    /**
     * Passage's text contents.
     */
    text: string;
}

/**
 * Metadata associated with a Twee 3 passage.
 */
export interface PassageMetadata {
    /**
     * Passage's position in the Twine editor (e.g. "600x400")
     */
    position?: string;
    /**
     * Passage's size in the Twine editor (e.g. "100")
     */
    size?: string;
}
