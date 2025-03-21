import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DecorationRange, StoryFormat } from "./client-server";
import {
    EmbeddedDocument,
    headerMetadataJSONUri,
    parseJSON,
    storyDataJSONUri,
} from "./embedded-languages";
import {
    Label,
    Passage,
    PassageMetadata,
    StoryData,
    ProjSymbol,
    TwineSymbolKind,
} from "./project-index";
import {
    closeMetaCharRegex,
    metadataRegex,
    openMetaCharRegex,
    tagRegex,
} from "./language";
import {
    StoryFormatParser,
    StoryFormatParsingState,
    capturePreSemanticTokenFor,
    getStoryFormatParser,
} from "./passage-text-parsers";
import {
    ETokenType,
    SemanticToken,
    TokenModifier,
    TokenType,
} from "./semantic-tokens";
import {
    DiagnosticsOptions,
    defaultDiagnosticsOptions,
} from "./server-options";
import {
    createDiagnosticFor,
    nextLineIndex,
    pairwise,
    removeAndCountPadding,
    skipSpaces,
} from "./utilities";

/**
 * At what level of detail to parse a Twee document.
 */
export enum ParseLevel {
    /**
     * Just the StoryData passage (if it exists) -- used to find the story format quickly.
     */
    StoryData = 1,
    /**
     * StoryData and names of passages, but not the content of passages.
     */
    PassageNames,
    /**
     * Everything.
     */
    Full,
}

/**
 * Captures information about the current state of parsing
 */
export interface ParsingState {
    /**
     * Document being validated.
     */
    textDocument: TextDocument;
    /**
     * Are we to parse passage contents?
     */
    parseLevel: ParseLevel;
    /**
     * What passage are we currently parsing the contents of?
     */
    currentPassage?: Passage;
    /**
     * Diagnostics options.
     */
    diagnosticsOptions: DiagnosticsOptions;
    /**
     * Story format (if known).
     */
    storyFormat?: StoryFormat;
    /**
     * The parser to parse passage contents (other than the StoryTitle and StoryData passages).
     */
    storyFormatParser: StoryFormatParser | undefined;
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
    onSymbolDefinition(symbol: ProjSymbol): void;
    onSymbolReference(symbol: ProjSymbol): void;
    onStoryTitle(title: string, range: Range): void;
    onStoryData(data: StoryData, range: Range): void;
    onEmbeddedDocument(document: EmbeddedDocument): void;
    onSemanticToken(token: SemanticToken): void;
    onFoldingRange(range: Range): void;
    onDecorationRange(range: DecorationRange): void;
    onParseError(error: Diagnostic): void;
}

//#region UtilityFunctions

/**
 * Utility functions for creating common parsing constructs.
 */

/**
 * Create a location for text in a document.
 *
 * @param text Document text to create the location for.
 * @param at Index where the text occurs in the document (zero-based).
 * @param doc Text document.
 * @returns The location containing the text.
 */
export function createLocationFor(
    text: string,
    at: number,
    doc: TextDocument
): Location {
    return Location.create(doc.uri, createRangeFor(text, at, doc));
}

/**
 * Create a range for text in a document.
 *
 * @param text Document text to create the range for.
 * @param at Index where the text occurs in the document (zero-based).
 * @param doc Text document.
 * @returns The range containing the text.
 */
export function createRangeFor(
    text: string,
    at: number,
    doc: TextDocument
): Range {
    return Range.create(doc.positionAt(at), doc.positionAt(at + text.length));
}

/**
 * Create a symbol for text in a document.
 *
 * @param text Document text for the symbol.
 * @param at Index where the text occurs in the document (zero-based).
 * @param kind Symbol kind.
 * @param doc Text document.
 * @returns The symbol.
 */
export function createSymbolFor(
    text: string,
    at: number,
    kind: number,
    doc: TextDocument
): ProjSymbol {
    return {
        contents: text,
        location: createLocationFor(text, at, doc),
        kind: kind,
    };
}

/**
 * Log an error associated with text in a document.
 *
 * @param text Document text that has the error.
 * @param at Index where the text occurs in the document (zero-based).
 * @param message Error message.
 * @param doc Text document.
 */
export function logErrorFor(
    text: string,
    at: number,
    message: string,
    state: ParsingState
): void {
    state.callbacks.onParseError(
        createDiagnosticFor(
            DiagnosticSeverity.Error,
            state.textDocument,
            text,
            at,
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
        createDiagnosticFor(
            DiagnosticSeverity.Warning,
            state.textDocument,
            text,
            at,
            message
        )
    );
}

/**
 * Log a semantic token associated with text in a document.
 *
 * @param text Document text to tokenize.
 * @param at Index where the text occurs in the document (zero-based).
 * @param type Semantic token type.
 * @param modifiers Token modifiers.
 * @param state Parsing state.
 */
export function logSemanticTokenFor(
    text: string,
    at: number,
    type: TokenType,
    modifiers: TokenModifier[],
    state: ParsingState
): void {
    let { line, character } = state.textDocument.positionAt(at);
    // Tokens can only span a single line, so split on those lines
    for (const t of text.split(/\r?\n/)) {
        if (t?.length) {
            state.callbacks.onSemanticToken({
                line: line,
                char: character,
                length: t.length,
                tokenType: type,
                tokenModifiers: modifiers,
            });
        }

        line++;
        character = 0;
    }
}

//#endregion

//#region SharedParsingFunctions

/**
 * Functions that both the main parser and the story format parsers use.
 */

/**
 * Parse a reference to a passage.
 *
 * @param passage Text name of the referenced passage.
 * @param at Index in the document where the passage reference occurs.
 * @param state Parsing state.
 * @param storyFormatParsingState Story-format-specific parsing state.
 */
export function parsePassageReference(
    passage: string,
    at: number,
    state: ParsingState,
    storyFormatParsingState: StoryFormatParsingState
): void {
    capturePreSemanticTokenFor(
        passage,
        at,
        ETokenType.class,
        [],
        storyFormatParsingState
    );

    state.callbacks.onSymbolReference({
        contents: passage,
        location: createLocationFor(passage, at, state.textDocument),
        kind: TwineSymbolKind.Passage,
    });
}

/**
 * A parsed Twine link, of the form [[target]], [[display|target]],
 * [[display->target]], or [[target->display]]
 */
export interface TwineLink {
    /**
     * String containing the target text.
     */
    target: string;
    /**
     * Index of the target text in the document.
     */
    targetIndex: number;
    /**
     * Optional display section
     */
    displaySection?: {
        /**
         * The divider character(s) (`|`, `->`, or `<-`), if present.
         */
        divider: string;
        /**
         * Index of the divider in the document.
         */
        dividerIndex: number;
        /**
         * String containing the text to be displayed, if present.
         */
        display: string;
        /**
         * Index of the display text in the document.
         */
        displayIndex: number;
    };
}

/**
 * Parse the internal text of a Twine link.
 *
 * @param linkText Text containing the link's internals without the [[ ]]
 * @param linkIndex Index in the document where the link text begins (zero-based).
 */
function parseLink(linkText: string, linkIndex: number): TwineLink {
    let display = linkText; // The section that will be displayed
    let displayIndex = 0; // Relative to the start of linkText
    let target = display;
    let targetIndex = displayIndex;
    let dividerIndex: number;
    let divider = "";

    // [[display|target]] format
    dividerIndex = display.indexOf("|");
    if (dividerIndex !== -1) {
        display = target.substring(0, dividerIndex);
        targetIndex = dividerIndex + 1;
        target = target.substring(targetIndex);
        divider = "|";
    } else {
        // [[display->target]] format
        dividerIndex = display.indexOf("->");

        if (dividerIndex !== -1) {
            display = target.substring(0, dividerIndex);
            targetIndex = dividerIndex + 2;
            target = target.substring(targetIndex);
            divider = "->";
        } else {
            // [[target<-display]] format
            dividerIndex = display.indexOf("<-");

            if (dividerIndex !== -1) {
                target = display.substring(0, dividerIndex);
                displayIndex = dividerIndex + 2;
                display = display.substring(displayIndex);
                divider = "<-";
            }
            // Otherwise [[target]] format
        }
    }

    let indexDelta;
    [target, targetIndex] = skipSpaces(target, targetIndex);
    const ret: TwineLink = {
        target: target,
        targetIndex: linkIndex + targetIndex,
    };
    if (dividerIndex !== -1) {
        [display, indexDelta] = removeAndCountPadding(display);
        displayIndex += indexDelta;
        ret.displaySection = {
            divider: divider,
            dividerIndex: linkIndex + dividerIndex,
            display: display,
            displayIndex: linkIndex + displayIndex,
        };
    }

    return ret;
}

/**
 * Find and parse Twine links.
 *
 * Story formats are responsible for calling this, but since the Twine link style is shared
 * among story formats, it's part of the main parsing code.
 *
 * Semantic tokens are captured in the passage text parsing state for them to submit
 * to the index later, as semantic tokens have to be in document order, and links
 * may be interspersed with other semantic tokens in a passage.
 *
 * @param subsection Subsection of the passage text section.
 * @param subsectionIndex Index in the document where the subsection begins (zero-based).
 * @param state Parsing state.
 * @param storyFormatParsingState Story-format-specific parsing state.
 * @returns Updated subsection with the link sections blanked out.
 */
export function findAndParseLinks(
    subsection: string,
    subsectionIndex: number,
    state: ParsingState,
    storyFormatParsingState: StoryFormatParsingState
): string {
    for (const m of subsection.matchAll(/\[\[(.*?)\]\]/g)) {
        // Get rid of the link from the subsection text so it doesn't get re-parsed when we look for other content
        subsection =
            subsection.slice(0, m.index) +
            " ".repeat(m[0].length) +
            subsection.slice(m.index + m[0].length);

        // Parse the link's contents. (The + 2 in the match is for the opening braces)
        const link = parseLink(m[1], subsectionIndex + m.index + 2);
        // Only capture target as a passage reference if it's not a URL
        if (!/^https?:\/\//.test(link.target))
            parsePassageReference(
                link.target,
                link.targetIndex,
                state,
                storyFormatParsingState
            );

        if (link.displaySection !== undefined) {
            capturePreSemanticTokenFor(
                link.displaySection.divider,
                link.displaySection.dividerIndex,
                ETokenType.keyword,
                [],
                storyFormatParsingState
            );
            capturePreSemanticTokenFor(
                link.displaySection.display,
                link.displaySection.displayIndex,
                ETokenType.string,
                [],
                storyFormatParsingState
            );
        }
    }

    return subsection;
}

const styleTagOpenRegex =
    /<style\b(?=[^>]*(?:(?:type=('text\/css'|"text\/css")|lang=(css|'css'|"css")))?)(?![^/>]*\/>$)>/gi;
const styleTagCloseRegex = /<\/style>/gi;

/**
 * Find and parse specific HTML tags that produce embedded documents.
 *
 * As with Twine links, story formats are responsible for calling this function.
 *
 * @param subsection Subsection of the passage text section.
 * @param subsectionIndex Index in the document where the subsection begins (zero-based).
 * @param state Parsing state.
 * @returns Updated subsection with the parsed HTML tags blanked out.
 */
export function findAndParseHtml(
    subsection: string,
    subsectionIndex: number,
    state: ParsingState
): string {
    styleTagOpenRegex.lastIndex = 0;
    // I'm going to pretend that no one ever nests style tags inside style tags
    for (const openMatch of subsection.matchAll(styleTagOpenRegex)) {
        // Find the closing tag, if any
        const styleOpenTagBeginIndex = openMatch.index;
        const openInnerIndex = styleOpenTagBeginIndex + openMatch[0].length;
        styleTagCloseRegex.lastIndex = openInnerIndex;
        const closeMatch = styleTagCloseRegex.exec(subsection);
        const closeInnerIndex =
            closeMatch !== null ? closeMatch.index : subsection.length;
        const styleCloseTagEndIndex =
            closeInnerIndex + (closeMatch !== null ? closeMatch[0].length : 0);

        // Create an embedded document
        const cssContents = subsection.slice(openInnerIndex, closeInnerIndex);
        state.callbacks.onEmbeddedDocument(
            EmbeddedDocument.create(
                "stylesheet",
                "css",
                cssContents,
                openInnerIndex + subsectionIndex,
                state.textDocument
            )
        );

        // Get rid of the style tags and embedded language section so it doesn't get re-parsed
        subsection =
            subsection.slice(0, openMatch.index) +
            " ".repeat(styleCloseTagEndIndex - styleOpenTagBeginIndex) +
            subsection.slice(styleCloseTagEndIndex);
    }

    return subsection;
}

//#endregion

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

    const subDocument = EmbeddedDocument.create(
        headerMetadataJSONUri,
        "json",
        rawMetadata,
        metadataIndex,
        state.textDocument
    );
    const jsonDocument = parseJSON(subDocument.document);

    for (const kid of jsonDocument.root?.children ?? []) {
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

    state.callbacks.onEmbeddedDocument(subDocument);

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
                m = openMetaCharRegex.exec(unparsedHeader); // Re-run to see if we have any trailing metadata
            }
        }

        if (m !== null && m[0] === "{") {
            const metaMatch = metadataRegex.exec(unparsedHeader);
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
    closeMetaCharRegex.lastIndex = 0;
    for (const closeMatch of name.matchAll(closeMetaCharRegex)) {
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
        isScript: tagNames?.includes("script") ?? false,
        isStylesheet: tagNames?.includes("stylesheet") ?? false,
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

    const subDocument = EmbeddedDocument.create(
        storyDataJSONUri,
        "json",
        passageText,
        textIndex,
        state.textDocument
    );
    const jsonDocument = parseJSON(subDocument.document);

    const storyFormat: StoryFormat = {
        format: "",
    };
    for (const kid of jsonDocument.root?.children ?? []) {
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
                storyData.tagColors = {};
                for (const prop of kid.valueNode.properties) {
                    if (prop.valueNode?.type === "string") {
                        storyData.tagColors[prop.keyNode.value] =
                            prop.valueNode.value;
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
    state.callbacks.onEmbeddedDocument(subDocument);

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
    state.callbacks.onEmbeddedDocument(
        EmbeddedDocument.create(
            "stylesheet",
            "css",
            passageText,
            textIndex,
            state.textDocument
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
    if (passage.name.contents === "StoryTitle") {
        parseStoryTitlePassage(passageText, textIndex, state);
    } else if (passage.name.contents === "StoryData") {
        // Do nothing -- we parsed it before parsing any other passages
    } else if (passage.isStylesheet) {
        parseStylesheetPassage(passageText, textIndex, state);
    } else {
        state.storyFormatParser?.parsePassageText(
            passageText,
            textIndex,
            state
        );
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
    // Set the currently-being-parsed passage
    state.currentPassage = passage;

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

    // Even if we're not to parse passage text, we call this function
    // since there are elements that we need to parse (like StoryTitle) regardless
    parsePassageText(passage, passageText, passageContentsStartIndex, state);

    // Unset the currently-being-parsed passage
    state.currentPassage = undefined;
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
        state.callbacks.onFoldingRange(passage1.scope);
    }

    // Handle the final passage, if any
    const lastPassage = passages.at(-1);
    if (lastPassage !== undefined) {
        findAndParsePassageContents(text, lastPassage, undefined, state);
        state.callbacks.onPassage(lastPassage);
        state.callbacks.onFoldingRange(lastPassage.scope);
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
 * @param callbacks Parser event callbacks.
 * @param parseLevel What level of parsing to do.
 * @param storyFormat Previous story format (if any) to use in parsing.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 */
export function parse(
    textDocument: TextDocument,
    callbacks: ParserCallbacks,
    parseLevel: ParseLevel,
    storyFormat?: StoryFormat,
    diagnosticsOptions?: DiagnosticsOptions
): void {
    const state: ParsingState = {
        textDocument: textDocument,
        parseLevel: parseLevel,
        diagnosticsOptions: diagnosticsOptions ?? defaultDiagnosticsOptions,
        storyFormatParser: undefined, // No story format parser to begin with
        callbacks: callbacks,
    };

    // Before anything else, see if we've got a story data passage, as,
    // if that changes the story format, it changes how we parse passages
    const docText = textDocument.getText();
    for (const storyDataMatch of docText.matchAll(
        /^::\s*StoryData\b.*?\r?\n/gm
    )) {
        if (storyDataMatch !== null) {
            const contentStartIndex =
                storyDataMatch.index + storyDataMatch[0].length;

            // Get the StoryData passage contents, which run to the next passage or at the end
            const nextPassageRegex = /^::/gm;
            nextPassageRegex.lastIndex = contentStartIndex;
            const nextPassageMatch = nextPassageRegex.exec(docText);
            let nextPassageIndex = nextPassageMatch?.index;
            if (nextPassageIndex !== undefined) {
                nextPassageIndex--;
            }
            const storyDataText = docText.slice(
                contentStartIndex,
                nextPassageIndex
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
    // In fact, if we're only to parse story data, we can return
    if (parseLevel === ParseLevel.StoryData) return;

    state.storyFormat = storyFormat;

    state.storyFormatParser = getStoryFormatParser(storyFormat);

    parseTwee3(state);
}
