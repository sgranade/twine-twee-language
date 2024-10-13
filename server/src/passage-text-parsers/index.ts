import {
    CompletionList,
    Definition,
    Diagnostic,
    Hover,
    Location,
    Position,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormat } from "../client-server";
import { ParsingState } from "../parser";
import { ProjectIndex } from "../project-index";
import { DiagnosticsOptions } from "../server-options";
import { TokenModifier, TokenType } from "../tokens";
import { getChapbookParser } from "./chapbook";
import { getSugarCubeParser } from "./sugarcube";

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
     * Note that this may be called even when state.parseLevel indicates that the passage
     * contents shouldn't be parsed. That's in case story formats need to index information
     * for project-wide diagnostics even if they're not doing a full passage contents parse.
     * It's up to the story format to check for that.
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
    /**
     * Generate hover information.
     *
     * @param document Document to generate hover information for.
     * @param position Position in the document to generate hover information.
     * @param index Project index.
     * @returns Hover information, or null for no hover information.
     */
    generateHover(
        document: TextDocument,
        position: Position,
        index: ProjectIndex
    ): Hover | null;
    /**
     * Get a symbol's definition by a position in a document.
     *
     * @param document Document to get definition at.
     * @param position Position in the document to find the definition from.
     * @param index Twine project index.
     * @returns Definition, or undefined for no definition at the given position.
     */
    getDefinitionAt(
        document: TextDocument,
        position: Position,
        index: ProjectIndex
    ): Definition | undefined;
    /**
     * Get references to a symbol by a position in a document.
     *
     * @param document Document to get references at.
     * @param position Position in the document to find the references from.
     * @param index Twine project index.
     * @param includeDefinition If true, include the symbol's definition in the references.
     * @returns Reference locations, or undefined for no symbol at the given position.
     */
    getReferencesToSymbolAt(
        document: TextDocument,
        position: Position,
        index: ProjectIndex,
        includeDeclaration: boolean
    ): Location[] | undefined;
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
    const formatName = format?.format.toLowerCase();
    if (formatName === "chapbook") {
        return getChapbookParser(format?.formatVersion);
    }
    if (formatName === "sugarcube") {
        return getSugarCubeParser(format?.formatVersion);
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
 * @param storyFormatState Story format parsing state.
 */
export function capturePreTokenFor(
    text: string,
    at: number,
    type: TokenType,
    modifiers: TokenModifier[],
    storyFormatState: StoryFormatParsingState
): void {
    if (text.length)
        storyFormatState.passageTokens[at] = {
            text,
            at,
            type,
            modifiers,
        };
}
