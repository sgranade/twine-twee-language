import { CompletionList, Diagnostic, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormat } from "../client-server";
import { ParsingState } from "../parser";
import { ProjectIndex } from "../project-index";
import { DiagnosticsOptions } from "../server-options";
import { TokenModifier, TokenType } from "../tokens";
import { getChapbookParser } from "./chapbook";

/**
 * Story-format-specific parsers that parse passage text.
 */
export interface StoryFormatParser {
    /**
     * ID for the parser: "format-version" where "version" is the e.g. "1.0.0" version.
     */
    id: string;
    /**
     * Parse a Twine passage's text.
     *
     * @param passageText Text of the passage to parse.
     * @param textIndex Index of the passage in the document (zero-based).
     * @param state Parsing state.
     */
    parsePassageText(
        passageText: string,
        textIndex: number,
        state: ParsingState
    ): void;
    /**
     * Generate completions at a position.
     *
     * @param document Document to generate completions in.
     * @param position Position in the document to generate completions.
     * @param index Twine project index.
     * @returns Completion list, or null for no completions.
     */
    generateCompletions(
        document: TextDocument,
        position: Position,
        index: ProjectIndex
    ): CompletionList | null;
    /**
     * Generate diagnostics.
     *
     * @param document Document to generate diagnostics for.
     * @param index Twine project index.
     * @param diagnosticsOptions Diagnostic options.
     */
    generateDiagnostics(
        document: TextDocument,
        index: ProjectIndex,
        diagnosticsOptions: DiagnosticsOptions
    ): Diagnostic[];
}

/**
 * Get a passage text parser for a given story format.
 *
 * @param format Story format.
 * @returns Parser, or undefined if no parser is available for the story format.
 */
export function getStoryFormatParser(
    format: StoryFormat | undefined
): StoryFormatParser | undefined {
    if (format?.format.toLowerCase() === "chapbook") {
        return getChapbookParser(format.formatVersion);
    }
    return undefined;
}

/**
 * Raw contents for a semantic token.
 */
export interface PreToken {
    /**
     * Token text.
     */
    text: string;
    /**
     * Index for the token's location in the document (zero-based).
     */
    at: number;
    /**
     * Type of token.
     */
    type: TokenType;
    /**
     * Token modifiers.
     */
    modifiers: TokenModifier[];
}

/**
 * Story-format-specific parsing state information
 */
export interface StoryFormatParsingState {
    /**
     * Information for semantic tokens generated in a text subsection.
     */
    passageTokens: Record<number, PreToken>;
}

/**
 * Capture pre-semantic-token information for later transmission.
 *
 * @param text Document text to tokenize.
 * @param at Index where the text occurs in the document (zero-based).
 * @param type Token type.
 * @param modifiers Token modifiers.
 * @param chapbookState Parsing state.
 */
export function capturePreTokenFor(
    text: string,
    at: number,
    type: TokenType,
    modifiers: TokenModifier[],
    state: StoryFormatParsingState
): void {
    if (text.length)
        state.passageTokens[at] = {
            text,
            at,
            type,
            modifiers,
        };
}
