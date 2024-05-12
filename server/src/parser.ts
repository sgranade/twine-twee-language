import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormat } from "./client-server";
import {
    EmbeddedDocument,
    headerMetadataJSONUri,
    parseJSON,
    storyDataJSONUri,
} from "./embedded-languages";
import { Label, Passage, PassageMetadata, StoryData } from "./index";
import {
    closeMetaCharPattern,
    metadataPattern,
    openMetaCharPattern,
    tagPattern,
} from "./language";
import { Token, TokenModifier, TokenType } from "./tokens";
import { createDiagnostic, nextLineIndex, pairwise } from "./utilities";
import {
    PassageTextParser,
    getPassageTextParser,
} from "./passage-text-parsers/passage-parser";

/**
 * Captures information about the current state of parsing
 */
export interface ParsingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;
    /**
     * The parser to parse passage contents (other than the StoryTitle and StoryData passages).
     */
    passageTextParser: PassageTextParser | undefined;
    /**
     * Callbacks for parsing events
     */
    callbacks: ParserCallbacks;
}

/**
 * Callbacks during parsing.
 */
export interface ParserCallbacks {
    onPassage(passage: Passage): void;
    onStoryTitle(title: string, range: Range): void;
    onStoryData(data: StoryData, range: Range): void;
    onEmbeddedDocument(document: EmbeddedDocument): void;
    onToken(token: Token): void;
    onParseError(error: Diagnostic): void;
}

/**
 * Log an error associated with text in a document.
 *
 * @param text Document text that has the error.
 * @param at Index where the text occurs in the document (zero-based).
 * @param message Error message.
 * @param state Parsing state.
 */
export function logErrorFor(
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
export function logWarningFor(
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
 * Log a token associated with text in a document.
 *
 * @param text Document text to tokenize.
 * @param at Index where the text occurs in the document (zero-based).
 * @param type Token type.
 * @param modifiers Token modifiers.
 * @param state Parsing state.
 */
export function logTokenFor(
    text: string,
    at: number,
    type: TokenType,
    modifiers: TokenModifier[],
    state: ParsingState
): void {
    const position = state.textDocument.positionAt(at);
    state.callbacks.onToken({
        line: position.line,
        char: position.character,
        length: text.length,
        tokenType: type,
        tokenModifiers: modifiers,
    });
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
    const metadata: PassageMetadata = {
        raw: {
            contents: rawMetadata,
            location: Location.create(
                state.textDocument.uri,
                Range.create(
                    state.textDocument.positionAt(metadataIndex),
                    state.textDocument.positionAt(
                        metadataIndex + rawMetadata.length
                    )
                )
            ),
        },
    };

    const subDocument = TextDocument.create(
        headerMetadataJSONUri,
        "json",
        state.textDocument.version,
        rawMetadata
    );
    const jsonDocument = parseJSON(subDocument);

    for (const kid of jsonDocument.root?.children || []) {
        if (kid.type === "property") {
            if (kid.valueNode?.type === "string") {
                if (kid.keyNode.value === "position") {
                    metadata.position = kid.valueNode.value;
                } else if (kid.keyNode.value === "size") {
                    metadata.size = kid.valueNode.value;
                }
            }
        }
    }

    state.callbacks.onEmbeddedDocument({
        document: subDocument,
        offset: metadataIndex,
        languageId: "json",
    });

    return metadata;
}

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
    let tags: Label[] | undefined;
    let metadata: PassageMetadata | undefined;
    const headerStartIndex = index + 2; // Index where the header string starts. The + 2 is for the leading "::"
    let parsingIndex = headerStartIndex; // Index where we're currently parsing.
    // Stop before an unescaped [ (for tags) or { (for metadata)
    let m = openMetaCharPattern.exec(unparsedHeader);
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
            const tagMatch = tagPattern.exec(unparsedHeader);
            if (tagMatch === null) {
                logErrorFor(
                    unparsedHeader,
                    parsingIndex,
                    "Tags aren't formatted correctly. Are you missing a ']'?",
                    state
                );
                unparsedHeader = "";
            } else {
                const rawTags = new Set(tagMatch[1].split(/\s+/));
                tags = Array.from(rawTags).map((tag): Label => {
                    const tagIndex = parsingIndex + tagMatch[0].indexOf(tag);
                    return {
                        contents: tag.replace(/\\(.)/g, "$1"),
                        location: Location.create(
                            state.textDocument.uri,
                            Range.create(
                                state.textDocument.positionAt(tagIndex),
                                state.textDocument.positionAt(
                                    tagIndex + tag.length
                                )
                            )
                        ),
                    };
                });
                unparsedHeader = unparsedHeader.substring(tagMatch[0].length);
                parsingIndex += tagMatch[0].length;
                m = openMetaCharPattern.exec(unparsedHeader); // Re-run to see if we have any trailing metadata
            }
        }

        if (m !== null && m[0] === "{") {
            const metaMatch = metadataPattern.exec(unparsedHeader);
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
    closeMetaCharPattern.lastIndex = 0;
    for (const closeMatch of name.matchAll(closeMetaCharPattern)) {
        logErrorFor(
            closeMatch[0],
            headerStartIndex + closeMatch.index,
            `Passage names can't include ${closeMatch[0]} without a \\ in front of it.`,
            state
        );
    }

    name = name.trim();
    const tagNames = tags?.map((x) => x.contents);
    const nameIndex = headerStartIndex + header.indexOf(name);
    const location = Location.create(
        state.textDocument.uri,
        Range.create(
            state.textDocument.positionAt(nameIndex),
            state.textDocument.positionAt(nameIndex + name.length)
        )
    );
    return {
        name: {
            contents: name.replace(/\\(.)/g, "$1").trim(), // Remove escape characters
            location: location,
        },
        scope: Range.create(location.range.start, location.range.end),
        isScript: tagNames?.includes("script") || false,
        isStylesheet: tagNames?.includes("stylesheet") || false,
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
 * Parse the contents of a StoryData passage.
 *
 * @param passageText Text contents of the StoryData passage.
 * @param textIndex Index of the text contents in the document.
 * @param state Parsing state.
 * @returns New story data.
 */
function parseStoryDataPassage(
    passageText: string,
    textIndex: number,
    state: ParsingState
): StoryData {
    const storyData: StoryData = {
        ifid: "",
    };

    const subDocument = TextDocument.create(
        storyDataJSONUri,
        "json",
        state.textDocument.version,
        passageText
    );
    const jsonDocument = parseJSON(subDocument);

    const storyFormat: StoryFormat = {
        format: "",
    };
    for (const kid of jsonDocument.root?.children || []) {
        if (kid.type === "property") {
            if (kid.valueNode?.type === "string") {
                if (kid.keyNode.value === "ifid") {
                    storyData.ifid = kid.valueNode.value;
                } else if (kid.keyNode.value === "format") {
                    storyFormat.format = kid.valueNode.value;
                } else if (kid.keyNode.value === "format-version") {
                    storyFormat.formatVersion = kid.valueNode.value;
                } else if (kid.keyNode.value === "start") {
                    storyData.start = kid.valueNode.value;
                }
            } else if (
                kid.valueNode?.type === "number" &&
                kid.keyNode.value === "zoom"
            ) {
                storyData.zoom = kid.valueNode.value;
            } else if (
                kid.valueNode?.type === "object" &&
                kid.keyNode.value === "tag-colors"
            ) {
                storyData.tagColors = new Map();
                for (const prop of kid.valueNode.properties) {
                    if (prop.valueNode?.type === "string") {
                        storyData.tagColors.set(
                            prop.keyNode.value,
                            prop.valueNode.value
                        );
                    }
                }
            }
        }
    }

    // If we found a story format, copy it over to storyData
    if (storyFormat.format !== "") {
        storyData.storyFormat = storyFormat;
    }

    const trimmedPassageText = passageText.trimEnd();
    state.callbacks.onStoryData(
        storyData,
        Range.create(
            state.textDocument.positionAt(textIndex),
            state.textDocument.positionAt(textIndex + trimmedPassageText.length)
        )
    );
    state.callbacks.onEmbeddedDocument({
        document: subDocument,
        offset: textIndex,
        languageId: "json",
    });

    return storyData;
}

/**
 * Parse the contents of a passage with the stylesheet tag.
 *
 * @param passageText Text contents of the stylesheet passage.
 * @param textIndex Index of the text contents in the document.
 * @param state Parsing state.
 */
function parseStylesheetPassage(
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    const subDocument = TextDocument.create(
        "stylesheet",
        "css",
        state.textDocument.version,
        passageText
    );
    state.callbacks.onEmbeddedDocument({
        document: subDocument,
        offset: textIndex,
        languageId: "css",
    });
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
    passageTextParser: PassageTextParser | undefined,
    state: ParsingState
): void {
    if (passage.name.contents === "StoryTitle") {
        parseStoryTitlePassage(passageText, textIndex, state);
    } else if (passage.name.contents === "StoryData") {
        // Do nothing -- we parsed it before parsing any other passages
    } else if (passage.isStylesheet) {
        parseStylesheetPassage(passageText, textIndex, state);
    } else if (passageTextParser !== undefined) {
        passageTextParser.parsePassageText(passageText, textIndex, state);
    }
}

/**
 * Find a passage's contents, set the passage's scope to include it, and (optionally) parse the contents.
 *
 * @param text Full text of the document.
 * @param passage Passage whose contents we should find and parse.
 * @param followingPassage The passage after the one to be processed, if any.
 * @param state Parsing state.
 */
function findAndParsePassageContents(
    text: string,
    passage: Passage,
    followingPassage: Passage | undefined,
    state: ParsingState
): void {
    // Find the passage's contents
    const passageContentsStartIndex = state.textDocument.offsetAt({
        line: passage.name.location.range.start.line + 1,
        character: 0,
    });
    const passageContentsEndIndex =
        followingPassage !== undefined
            ? nextLineIndex(
                  text,
                  state.textDocument.offsetAt({
                      line: followingPassage.name.location.range.start.line - 1,
                      character: 0,
                  })
              )
            : undefined;
    const passageText = text.substring(
        passageContentsStartIndex,
        passageContentsEndIndex
    );

    // Update the passage's scope to encompass the contents, not counting
    // any ending \r or \n
    passage.scope = Range.create(
        {
            line: passage.name.location.range.start.line,
            character: 0,
        },
        state.textDocument.positionAt(
            passageContentsStartIndex +
                passageText.replace(/\r?\n$/g, "").length
        )
    );

    parsePassageText(
        passage,
        passageText,
        passageContentsStartIndex,
        undefined,
        state
    );
}

/**
 * Parse text from a Twee 3 document.
 * @param state Parsing state.
 */
function parseTwee3(state: ParsingState): void {
    const text = state.textDocument.getText();

    // Generate all passages
    const passages = [...text.matchAll(/^::([^:].*?|)$/gm)].map((m) =>
        parsePassageHeader(m[1], m.index, state)
    );

    // Call back on the passages, along with their contents.
    // This will cover every passage except the last one in the array.
    for (const [passage1, passage2] of pairwise(passages)) {
        findAndParsePassageContents(text, passage1, passage2, state);
        state.callbacks.onPassage(passage1);
    }

    // Handle the final passage, if any
    const lastPassage = passages.at(-1);
    if (lastPassage !== undefined) {
        findAndParsePassageContents(text, lastPassage, undefined, state);
        state.callbacks.onPassage(lastPassage);
    }
}

/**
 * Parse a Twee 3 document.
 *
 * Passage content parsing is optional so that documents can be quickly parsed
 * to build an initial index of passage names. Even if passage content parsing
 * is skipped, though, the StoryTitle and StoryData passages are still parsed.
 *
 * @param textDocument Document to parse.
 * @param storyFormat Previous story format (if any) to use in parsing.
 * @param parsePassageContents Whether to parse passage contents.
 * @param callbacks Parser event callbacks.
 */
export function parse(
    textDocument: TextDocument,
    storyFormat: StoryFormat | undefined,
    parsePassageContents: boolean,
    callbacks: ParserCallbacks
): void {
    const state = {
        textDocument,
        passageTextParser: undefined, // No passage text parser to begin with
        callbacks,
    };

    // Before anything else, see if we've got a story data passage, as
    // if that changes the story format, it changes how we parse passages
    const docText = textDocument.getText();
    for (const storyDataMatch of docText.matchAll(
        /^::\s*StoryData\b.*?\r?\n/gm
    )) {
        if (storyDataMatch !== null) {
            const contentStartIndex =
                storyDataMatch.index + storyDataMatch[0].length;

            // Get the StoryData passage contents, which run to the next passage or at the end
            const nextPassageRegex = /^::/;
            nextPassageRegex.lastIndex = contentStartIndex;
            const nextPassageMatch = nextPassageRegex.exec(docText);
            const storyDataText = docText.slice(
                contentStartIndex,
                nextPassageMatch?.index || undefined
            );

            const storyData = parseStoryDataPassage(
                storyDataText,
                contentStartIndex,
                state
            );
            if (
                storyData.storyFormat?.format !== storyFormat?.format ||
                storyData.storyFormat?.formatVersion !==
                    storyFormat?.formatVersion
            ) {
                storyFormat = storyData.storyFormat;
            }
        }
    }

    parseTwee3({
        textDocument,
        passageTextParser: parsePassageContents
            ? getPassageTextParser(storyFormat)
            : undefined,
        callbacks,
    });
}
