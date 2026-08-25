import { Range } from "vscode-languageserver-protocol";

/**
 * Messages
 */

export enum CustomMessages {
    RequestReindex = "twee3/requestReindex",
    IndexingStarted = "twee3/indexingStarted",
    IndexingComplete = "twee3/indexingComplete",
    RequestDiagnosticCodes = "twee3/requestDiagnosticCodes",
    DiagnosticCodes = "twee3/diagnosticCodes",
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
