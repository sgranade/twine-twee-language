import {
    Range,
    Location,
    Diagnostic,
    DiagnosticSeverity,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Passage, PassageMetadata, StoryData } from "./index";
import { createDiagnostic, pairwise } from "./utilities";

export interface ParserCallbacks {
    onPassage(passage: Passage, contents: string): void;
    onStoryTitle(title: string, range: Range): void;
    onStoryData(data: StoryData, range: Range): void;
    onParseError(error: Diagnostic): void;
}

/**
 * Captures information about the current state of parsing
 */
export class ParsingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;
    /**
     * Document's normalized URI.
     */
    textDocumentUri: string;
    /**
     * Callbacks for parsing events
     */
    callbacks: ParserCallbacks;

    constructor(textDocument: TextDocument, callbacks: ParserCallbacks) {
        this.textDocument = textDocument;
        this.textDocumentUri = textDocument.uri;
        this.callbacks = callbacks;
    }
}

/**
 * Log an error associated with text in a document.
 *
 * @param text Document text that has the error.
 * @param at Index where the text occurs in the document (zero-based).
 * @param message Error message.
 * @param state Parsing state.
 */
function logErrorFor(
    text: string,
    at: number,
    message: string,
    state: ParsingState
): void {
    state.callbacks.onParseError(
        createDiagnostic(
            DiagnosticSeverity.Error,
            state.textDocument,
            at,
            at + text.length,
            message
        )
    );
}

/**
 * Log a warning associated with text in a document.
 *
 * @param text Document text that has the error.
 * @param at Index where the text occurs in the document (zero-based).
 * @param message Error message.
 * @param state Parsing state.
 */
function logWarningFor(
    text: string,
    at: number,
    message: string,
    state: ParsingState
): void {
    state.callbacks.onParseError(
        createDiagnostic(
            DiagnosticSeverity.Warning,
            state.textDocument,
            at,
            at + text.length,
            message
        )
    );
}

/**
 * Parse header metadata.
 *
 * @param rawMetadata String containing the unparsed metadata (such as '{"position":"600x400"}')
 * @param metadataIndex Unparsed metadata's location in the document (zero-based index).
 * @param state Parsing state.
 * @returns Parsed header metadata.
 */
function parseHeaderMetadata(
    rawMetadata: string,
    metadataIndex: number,
    state: ParsingState
): PassageMetadata {
    let positionMeta: string | undefined;
    let sizeMeta: string | undefined;

    let metadataObject;
    try {
        metadataObject = JSON.parse(rawMetadata);
    } catch {
        let errorMessage = "Metadata isn't properly-formatted JSON.";
        if (rawMetadata.includes("'")) {
            errorMessage += " Did you use ' instead of \"?";
        }
        logErrorFor(rawMetadata, metadataIndex, errorMessage, state);
        return {};
    }

    for (const [k, v] of Object.entries(metadataObject)) {
        const vAsString = String(v);
        const valueIndex = rawMetadata.indexOf(vAsString);
        if (k === "position") {
            if (typeof v === "string") {
                if (!/^\d+,\d+$/.test(v)) {
                    logErrorFor(
                        vAsString,
                        metadataIndex + valueIndex,
                        `"position" metadata should give the tile location in x,y: "600,400".`,
                        state
                    );
                } else {
                    positionMeta = v;
                }
            } else {
                logErrorFor(
                    vAsString,
                    metadataIndex + valueIndex,
                    `Must be a string.`,
                    state
                );
            }
        } else if (k === "size") {
            if (typeof v === "string") {
                if (!/^\d+,\d+$/.test(v)) {
                    logErrorFor(
                        vAsString,
                        metadataIndex + valueIndex,
                        `"size" metadata should give the tile size in width,height: "100,200"`,
                        state
                    );
                } else {
                    sizeMeta = v;
                }
            } else {
                logErrorFor(
                    vAsString,
                    metadataIndex + valueIndex,
                    `Must be a string.`,
                    state
                );
            }
        } else {
            const keyIndex = rawMetadata.indexOf(k);
            logErrorFor(
                k,
                metadataIndex + keyIndex,
                `Unsupported metadata property.`,
                state
            );
        }
    }

    return { position: positionMeta, size: sizeMeta };
}

const headerMetaCharPattern = /(?<!\\)(\{|\[)/;

/**
 * Parse a passage header.
 *
 * @param header Text of the header line, without the leading "::" start token.
 * @param index Passage's location in the document, including the "::" token (zero-based index).
 * @param state Parsing state.
 * @returns Parsed passage object.
 */
function parsePassageHeader(
    header: string,
    index: number,
    state: ParsingState
): Passage {
    let unparsedHeader = header;
    let name = "";
    let tags: string[] | undefined;
    let metadata: PassageMetadata | undefined;
    const headerStartIndex = index + 2; // Index where the header string starts. The + 2 is for the leading "::"
    let parsingIndex = headerStartIndex; // Index where we're currently parsing.
    const location = Location.create(
        state.textDocumentUri,
        Range.create(
            state.textDocument.positionAt(index),
            state.textDocument.positionAt(parsingIndex + header.length)
        )
    );

    // Stop before an unescaped [ (for tags) or { (for metadata)
    let m = headerMetaCharPattern.exec(unparsedHeader);
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
            const tagMatch = /\[(.*?)((?<!\\)\])\s*/.exec(unparsedHeader);
            if (tagMatch === null) {
                logErrorFor(
                    unparsedHeader,
                    parsingIndex,
                    "Tags aren't formatted correctly. Are you missing a ']'?",
                    state
                );
                unparsedHeader = "";
            } else {
                tags = tagMatch[1].replace(/\\(.)/g, "$1").split(" ");
                unparsedHeader = unparsedHeader.substring(tagMatch[0].length);
                parsingIndex += tagMatch[0].length;
                m = headerMetaCharPattern.exec(unparsedHeader); // Re-run to see if we have any trailing metadata
            }
        }

        if (m !== null && m[0] === "{") {
            const metaMatch = /(\{(.*?)((?<!\\)\}))\s*/.exec(unparsedHeader);
            if (metaMatch === null) {
                logErrorFor(
                    unparsedHeader,
                    parsingIndex,
                    "Metadata isn't formatted correctly. Are you missing a '}'?",
                    state
                );
                unparsedHeader = "";
            } else {
                metadata = parseHeaderMetadata(
                    metaMatch[1],
                    parsingIndex + metaMatch.index,
                    state
                );
                unparsedHeader = unparsedHeader.substring(metaMatch[0].length);
                parsingIndex += metaMatch[0].length;
            }
        }
    }

    // If there's any text remaining, it's after a tag or metadata section and isn't allowed
    if (unparsedHeader.trim().length > 0) {
        // Is there a tag section after the metadata?
        const misplacedTagMatch = /(?<!\\)\[.*?(?<!\\)\]/.exec(unparsedHeader);
        if (misplacedTagMatch !== null) {
            logErrorFor(
                misplacedTagMatch[0],
                parsingIndex + misplacedTagMatch.index,
                "Tags need to come before metadata.",
                state
            );
        } else {
            logErrorFor(
                unparsedHeader,
                parsingIndex,
                `Passage headers can't have text after ${metadata !== undefined ? "metadata" : "tags"}`,
                state
            );
        }
    }

    // If the name contains unescaped tag or block closing characters, flag them.
    // (No need to check for tag/block opening characters, as they'll be processed above.)
    for (const closeMatch of name.matchAll(/(?<!\\)(\}|\])/gm)) {
        logErrorFor(
            closeMatch[0],
            headerStartIndex + closeMatch.index,
            `Passage names can't include ${closeMatch[0]} without a \\ in front of it.`,
            state
        );
    }

    return {
        name: name.replace(/\\(.)/g, "$1").trim(), // Remove escape characters
        location: location,
        isScript: tags?.includes("script") || false,
        isStylesheet: tags?.includes("stylesheet") || false,
        tags: tags,
        metadata: metadata,
    };
}

/**
 * Parse the StoryTitle passage.
 * @param passageText Text of the StoryTitle passage.
 * @param textIndex Index in the document where the passage text begins (zero-based).
 * @param state Parsing state.
 */
function parseStoryTitlePassage(
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    const trimmedPassageText = passageText.trimEnd();
    state.callbacks.onStoryTitle(
        trimmedPassageText,
        Range.create(
            state.textDocument.positionAt(textIndex),
            state.textDocument.positionAt(textIndex + trimmedPassageText.length)
        )
    );
}

/**
 * Validate the IFID field of StoryData.
 *
 * Any errors are logged as Diagnostics.
 *
 * @param ifid Contents of the IFID field.
 * @param index Index of the IFID in the document.
 * @param state Parsing state.
 * @returns True if the IFID is properly formatted; false otherwise.
 */
function validateIfid(
    ifid: unknown,
    index: number,
    state: ParsingState
): boolean {
    let valid = false;

    if (typeof ifid === "string") {
        if (
            !/^[a-fA-F\d]{8}-[a-fA-F\d]{4}-4[a-fA-F\d]{3}-[a-fA-F\d]{4}-[a-fA-F\d]{12}$/.test(
                ifid
            )
        ) {
            logErrorFor(ifid, index, `"ifid" must be a version 4 UUID.`, state);
        } else {
            valid = true;
            if (/[a-f]/.test(ifid)) {
                logWarningFor(
                    ifid,
                    index,
                    `"ifid" must only have captial letters.`,
                    state
                );
            }
        }
    } else {
        logErrorFor(String(ifid), index, `Must be a string.`, state);
    }

    return valid;
}

/**
 * Parse the tag-colors field of StoryData.
 *
 * @param tagColorsObject JSON-decoded object with the tag-colors.
 * @param rawTagColorText Raw JSON-encoded text of the tag-colors.
 * @param rawTagColorIndex Index of the raw text in the document.
 * @param state Parsing state.
 * @returns Map of tag names to color names, or undefined if parsing failed.
 */
function parseTagColors(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tagColorsObject: any,
    rawTagColorText: string,
    rawTagColorIndex: number,
    state: ParsingState
): Map<string, string> | undefined {
    const tagColors = new Map<string, string>();

    for (const [k, v] of Object.entries(tagColorsObject)) {
        if (typeof v === "string") {
            tagColors.set(k, v);
        } else {
            const vAsString = String(v);
            const vIndex = rawTagColorText.indexOf(vAsString);
            if (vIndex >= 0) {
                logErrorFor(
                    vAsString,
                    rawTagColorIndex + vIndex,
                    "Must be a string",
                    state
                );
            } else {
                const kAsString = `"${k}"`;
                const kIndex = rawTagColorText.indexOf(kAsString);
                logErrorFor(
                    kAsString,
                    rawTagColorIndex + kIndex,
                    `The value for key ${k} must be a string`,
                    state
                );
            }
        }
    }

    return tagColors.size == 0 ? undefined : tagColors;
}

/**
 * Parse the contents of a StoryData passage.
 *
 * @param passageText Text contents of the StoryData passage.
 * @param textIndex Index of the text contents in the document.
 * @param state Parsing state.
 */
function parseStoryDataPassage(
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    let storyDataObject;
    let ifidFound = false;
    const storyData: StoryData = { ifid: "" };
    try {
        storyDataObject = JSON.parse(passageText);
    } catch {
        let errorMessage = "StoryData isn't properly-formatted JSON.";
        if (passageText.includes("'")) {
            errorMessage += " Did you use ' instead of \"?";
        }
        logErrorFor(passageText, textIndex, errorMessage, state);
        return;
    }

    for (const [k, v] of Object.entries(storyDataObject)) {
        const vAsString = String(v);
        const valueIndex = textIndex + passageText.indexOf(vAsString);
        if (k === "ifid") {
            ifidFound = true;
            if (validateIfid(v, valueIndex, state)) {
                storyData.ifid = String(v);
            }
        } else if (k === "format") {
            if (typeof v === "string") {
                storyData.format = v;
            } else {
                logErrorFor(vAsString, valueIndex, "Must be a string.", state);
            }
        } else if (k === "format-version") {
            if (typeof v === "string") {
                storyData.formatVersion = v;
            } else {
                logErrorFor(vAsString, valueIndex, "Must be a string.", state);
            }
        } else if (k === "start") {
            if (typeof v === "string") {
                storyData.start = v;
            } else {
                logErrorFor(vAsString, valueIndex, "Must be a string.", state);
            }
        } else if (k === "tag-colors") {
            const m = /"tag-colors"\s*:\s*\{.*?\}/s.exec(passageText);
            if (m !== null) {
                const tagColors = parseTagColors(
                    v,
                    m[0],
                    textIndex + m.index,
                    state
                );
                if (tagColors !== undefined) {
                    storyData.tagColors = tagColors;
                }
            } else {
                const kAsString = `"${k}"`;
                const keyIndex = textIndex + passageText.indexOf(kAsString);
                logErrorFor(
                    kAsString,
                    keyIndex,
                    '"tag-colors" must be a JSON object of tag name to color pairs, like {"tag": "color"}',
                    state
                );
            }
        } else if (k === "zoom") {
            if (typeof v === "number") {
                storyData.zoom = v;
            } else {
                logErrorFor(vAsString, valueIndex, "Must be a number.", state);
            }
        } else {
            const keyIndex = passageText.indexOf(k);
            logErrorFor(
                k,
                textIndex + keyIndex,
                `Unsupported StoryData property.`,
                state
            );
        }
    }

    if (!ifidFound) {
        logErrorFor(
            passageText,
            textIndex,
            'StoryData must include an "ifid" property.',
            state
        );
    }

    const trimmedPassageText = passageText.trimEnd();
    state.callbacks.onStoryData(
        storyData,
        Range.create(
            state.textDocument.positionAt(textIndex),
            state.textDocument.positionAt(textIndex + trimmedPassageText.length)
        )
    );
}

/**
 * Parse passage text.
 *
 * @param passage Information about the passage.
 * @param passageText Text of the passage.
 * @param textIndex Index in the document where the passage text begins (zero-based).
 * @param state Parsing state.
 */
function parsePassageText(
    passage: Passage,
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    if (passage.name === "StoryTitle") {
        parseStoryTitlePassage(passageText, textIndex, state);
    } else if (passage.name === "StoryData") {
        parseStoryDataPassage(passageText, textIndex, state);
    }
}

/**
 * Parse text from a Twee 3 document.
 * @param text Document text.
 * @param state Parsing state.
 */
function parseTwee3(text: string, state: ParsingState): void {
    // Generate all passages
    const passages = [...text.matchAll(/^::([^:].*?|)$/gm)].map((m) =>
        parsePassageHeader(m[1], m.index, state)
    );

    // Call back on the passages, along with their contents
    for (const [passage1, passage2] of pairwise(passages)) {
        const passageTextIndex =
            state.textDocument.offsetAt(passage1.location.range.end) + 1; // +1 to swallow the \n
        const passageText = text.substring(
            passageTextIndex,
            state.textDocument.offsetAt(passage2.location.range.start) - 1
        );
        parsePassageText(passage1, passageText, passageTextIndex, state);
        state.callbacks.onPassage(passage1, passageText);
    }

    // Handle the final passage, if any
    const lastPassage = passages.at(-1);
    if (lastPassage !== undefined) {
        const passageTextIndex =
            state.textDocument.offsetAt(lastPassage.location.range.end) + 1; // +1 to swallow the \n
        const passageText = text.substring(passageTextIndex);
        parsePassageText(lastPassage, passageText, passageTextIndex, state);
        state.callbacks.onPassage(lastPassage, passageText);
    }
}

/**
 * Parse a Twee 3 document.
 *
 * @param textDocument Document to parse.
 * @param callbacks Parser event callbacks.
 */
export function parse(
    textDocument: TextDocument,
    callbacks: ParserCallbacks
): void {
    const state = new ParsingState(textDocument, callbacks);
    const text = textDocument.getText();

    parseTwee3(text, state);
}
