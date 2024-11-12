import { StoryFormat } from "../client-server";
import { PassageMetadata, Passage, Story, StoryData } from "./types";

export class TweeParseError extends Error {
    /**
     * Index into the document where the error begins.
     */
    start: number;
    /**
     * Index into the document where the error ends.
     */
    end: number;
    constructor(message: string, start: number, end: number) {
        super(message);
        this.start = start;
        this.end = end;
        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Regex to find the tags portion of a Twee 3 header.
 */
const tagRegex = /\[(.*?)((?<!\\)\])\s*/;

/**
 * Regex to find an opening meta character in a Twee 3 header.
 */
const openMetaCharRegex = /(?<!\\)(\{|\[)/;

/**
 * Regex to find a closing meta characters in a Twee 3 passage name.
 */
const closeMetaCharRegex = /(?<!\\)(\}|\])/gm;

/**
 * Regex to find the metadata portion of a Twee 3 header.
 */
const metadataRegex = /(\{(.*?)((?<!\\)\}))\s*/;

/**
 * Parse header metadata.
 *
 * @param rawMetadata String containing the unparsed metadata (such as '{"position":"600x400"}')
 * @param metadataIndex Unparsed metadata's location in the document (zero-based index).
 * @returns Parsed header metadata.
 * @throws TweeParseError on parse error.
 */
function parseHeaderMetadata(
    rawMetadata: string,
    metadataIndex: number
): PassageMetadata {
    const metadata: PassageMetadata = {};

    try {
        const jsonMetadata = JSON.parse(rawMetadata);
        if (typeof jsonMetadata["position"] === "string")
            metadata.position = jsonMetadata["position"];
        if (typeof jsonMetadata["size"] === "string")
            metadata.size = jsonMetadata["size"];
    } catch (err) {
        throw new TweeParseError(
            `Couldn't parse metadata: ${err.message}`,
            metadataIndex,
            metadataIndex + rawMetadata.length
        );
    }

    return metadata;
}

/**
 * Parse a passage header.
 *
 * @param header Text of the header line, without the leading "::" start sigil.
 * @param index Header line's location in the document, just after the "::" sigil (zero-based index).
 * @returns Parsed passage object.
 * @throws TweeParseError on parse error.
 */
function parsePassageHeader(header: string, index: number): Passage {
    let unparsedHeader = header;
    let name = "";
    let tags: string[] | undefined;
    let metadata: PassageMetadata | undefined;
    let parsingIndex = index; // Index where we're currently parsing.
    // Stop before an unescaped [ (for tags) or { (for metadata)
    let m = openMetaCharRegex.exec(unparsedHeader);
    if (m === null) {
        // Easy peasy: the header's just a passage name
        name = unparsedHeader;
        unparsedHeader = "";
    } else {
        name = unparsedHeader.substring(0, m.index);
        unparsedHeader = unparsedHeader.substring(m.index);
        parsingIndex += m.index;

        // Handle tags (which should come before any metadata)
        if (m[0] === "[") {
            const tagMatch = tagRegex.exec(unparsedHeader);
            if (tagMatch === null) {
                throw new TweeParseError(
                    "Tags aren't formatted correctly",
                    parsingIndex,
                    parsingIndex + unparsedHeader.length
                );
            } else {
                const rawTags = new Set(tagMatch[1].split(/\s+/));
                tags = Array.from(rawTags).map((tag) =>
                    tag.replace(/\\(.)/g, "$1")
                );
                unparsedHeader = unparsedHeader.substring(tagMatch[0].length);
                parsingIndex += tagMatch[0].length;
                m = openMetaCharRegex.exec(unparsedHeader); // Re-run to see if we have any trailing metadata
            }
        }

        if (m !== null && m[0] === "{") {
            const metaMatch = metadataRegex.exec(unparsedHeader);
            if (metaMatch === null) {
                throw new TweeParseError(
                    "Metadata isn't formatted correctly",
                    parsingIndex,
                    parsingIndex + unparsedHeader.length
                );
            } else {
                metadata = parseHeaderMetadata(
                    metaMatch[1],
                    parsingIndex + metaMatch.index
                );
                unparsedHeader = unparsedHeader.substring(metaMatch[0].length);
                parsingIndex += metaMatch[0].length;
            }
        }
    }

    // If there's any text remaining, it's after a tag or metadata section and isn't allowed
    if (unparsedHeader.trim().length > 0) {
        const msg = unparsedHeader.trimStart().startsWith("[")
            ? "Tags need to come before metadata"
            : "No text allowed after passage tags or metadata";
        throw new TweeParseError(
            msg,
            parsingIndex,
            parsingIndex + unparsedHeader.length
        );
    }

    // If the name contains unescaped tag or block closing characters, flag them.
    // (No need to check for tag/block opening characters, as they'll be processed above.)
    closeMetaCharRegex.lastIndex = 0;
    const closeMatch = closeMetaCharRegex.exec(name);
    if (closeMatch !== null) {
        throw new TweeParseError(
            `Passage names can't include ${closeMatch[0]} without a \\ in front of it`,
            index + closeMatch.index,
            index + closeMatch.index + 1
        );
    }

    const passage: Passage = {
        name: name.trim().replace(/\\(.)/g, "$1"),
        isScript: tags?.includes("script") ?? false,
        isStylesheet: tags?.includes("stylesheet") ?? false,
        text: "",
    };
    if (metadata) {
        passage.metadata = metadata;
    }
    if (tags) {
        passage.tags = tags;
    }
    return passage;
}

/**
 * Parse the StoryTitle passage.
 * @param story Twine story.
 * @param passageText Text of the StoryTitle passage.
 */
function parseStoryTitlePassage(story: Story, passageText: string): void {
    story.name = passageText.trim();
}

/**
 * Parse the contents of a StoryData passage.
 *
 * @param story Twine story.
 * @param passageText Text contents of the StoryData passage.
 * @param textIndex Index of the text contents in the document.
 * @throws TweeParseError on parse error.
 */
function parseStoryDataPassage(
    story: Story,
    passageText: string,
    textIndex: number
): void {
    const storyData: StoryData = {
        ifid: "",
    };
    const storyFormat: StoryFormat = {
        format: "",
    };

    try {
        const jsonData = JSON.parse(passageText);
        if (typeof jsonData["ifid"] === "string") {
            storyData.ifid = jsonData["ifid"]?.toUpperCase().trim();
            if (
                !/^[a-fA-F\d]{8}-[a-fA-F\d]{4}-4[a-fA-F\d]{3}-[a-fA-F\d]{4}-[a-fA-F\d]{12}$/.test(
                    storyData.ifid
                )
            ) {
                throw new TweeParseError(
                    `StoryData passage has a badly-formatted IFID value: ${jsonData["ifid"].trim()}`,
                    textIndex,
                    textIndex + passageText.length
                );
            }
        } else if (jsonData["ifid"] === undefined) {
            throw new TweeParseError(
                `StoryData passage is missing an IFID value`,
                textIndex,
                textIndex + passageText.length
            );
        }
        if (typeof jsonData["format"] === "string")
            storyFormat.format = jsonData["format"];
        if (typeof jsonData["format-version"] === "string")
            storyFormat.formatVersion = jsonData["format-version"];
        if (typeof jsonData["start"] === "string")
            storyData.start = jsonData["start"];
        if (typeof jsonData["zoom"] === "number" && jsonData["zoom"] !== 0)
            storyData.zoom = jsonData["zoom"];
        if (typeof jsonData["tag-colors"] === "object") {
            storyData.tagColors = {};
            for (const [t, c] of Object.entries(jsonData["tag-colors"])) {
                if (typeof c === "string") {
                    storyData.tagColors[t] = c;
                }
            }
        }
    } catch (err) {
        throw new TweeParseError(
            `Couldn't parse StoryData passage: ${err.message}`,
            textIndex,
            textIndex + passageText.length
        );
    }

    // If we found a story format, copy it over to storyData
    if (storyFormat.format !== "") {
        storyData.storyFormat = storyFormat;
    }

    story.storyData = storyData;
}

/**
 * Parse passage text.
 *
 * @param passage Information about the passage.
 * @param textIndex Index in the document where the passage text begins (zero-based).
 * @param state Parsing state.
 */
function parsePassageText(
    story: Story,
    passage: Passage,
    textIndex: number
): void {
    if (passage.name === "StoryTitle") {
        parseStoryTitlePassage(story, passage.text);
    } else if (passage.name === "StoryData") {
        parseStoryDataPassage(story, passage.text, textIndex);
    }
}

/**
 * Parse text from a Twee 3 document.
 *
 * @param state Parsing state.
 * @returns List of parsed passages.
 * @throws TweeParseError on parsing error.
 */
export function parseTwee3(story: Story, text: string): void {
    const passageHeaderMatches = [...text.matchAll(/^::([^:].*?|)$/gm)];
    const passages: Passage[] = new Array(passageHeaderMatches.length);

    for (const [ndx, m] of passageHeaderMatches.entries()) {
        const passage = parsePassageHeader(m[1], m.index + 2);
        // The text runs from right after the current header to the
        // next header, or the end of the string if there's no next header
        passage.text = text.slice(
            m.index + m[0].length,
            ndx < passages.length - 1
                ? passageHeaderMatches[ndx + 1].index
                : undefined
        );
        parsePassageText(story, passage, m.index + m[0].length);
        passage.text = passage.text.trim();
        passages[ndx] = passage;
    }

    story.passages.push(...passages);
    return undefined;
}
