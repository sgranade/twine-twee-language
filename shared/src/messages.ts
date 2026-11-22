import { Range } from "vscode-languageserver-protocol";

/**
 * Messages
 */
export enum CustomMessages {
    RequestReindex = "twee3/requestReindex",
    IndexingStarted = "twee3/indexingStarted",
    IndexingComplete = "twee3/indexingComplete",
    RequestDecorationRanges = "twee3/requestDecorationRanges",
    DecorationRanges = "twee3/decorationRanges",
    UpdatedStoryFormat = "twee3/storyformat",
    UpdatedStoryTitle = "twee3/storytitle",
    UpdatedSugarCubeMacroList = "twee3/sugarcube/macrolist",
}

/**
 * Story format information sent as part of the UpdatedStoryFormat message.
 */
export interface StoryFormat {
    format: string;
    formatVersion?: string;
}

/**
 * Do two story formats differ?
 *
 * Format names are compared ignoring case; versions must match exactly.
 */
export function storyFormatsDiffer(
    a: StoryFormat | undefined,
    b: StoryFormat | undefined,
): boolean {
    return (
        a?.format.toLowerCase() !== b?.format.toLowerCase() ||
        a?.formatVersion !== b?.formatVersion
    );
}

/**
 * Diagnostic codes sent via the diagnosticCodes message.
 */
export interface DiagnosticCodeInfo {
    codes: readonly string[];
}

/**
 * Decoration range information sent via the decorationRanges message.
 */
export interface DecorationRangeInfo {
    uri: string;
    ranges: readonly DecorationRange[];
}

/**
 * Type of decoration ranges the server reports.
 */
export enum DecorationType {
    ChapbookModifierContent = 1,
    ChapbookVarsSection = 2,
}

/**
 * A range in the document that a client can optionally decorate.
 */
export interface DecorationRange {
    range: Range;
    type: DecorationType;
}
