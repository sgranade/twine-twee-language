import { StoryFormat } from "../client-server";
import { ParsingState } from "../parser";
import { TokenModifier, TokenType } from "../tokens";
import { getChapbookParser } from "./chapbook";

/**
 * Story-format-specific parsers that parse passage text.
 */
export interface PassageTextParser {
    id: string;
    parsePassageText(
        passageText: string,
        textIndex: number,
        state: ParsingState
    ): void;
}

/**
 * Get a passage text parser for a given story format.
 *
 * @param format Story format.
 * @returns Parser, or undefined if no parser is available for the story format.
 */
export function getPassageTextParser(
    format: StoryFormat | undefined
): PassageTextParser | undefined {
    if (format?.format.toLowerCase() == "chapbook") {
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
export interface PassageTextParsingState {
    /**
     * Information for semantic tokens generated in a text subsection.
     */
    textSubsectionTokens: Record<number, PreToken>;
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
    state: PassageTextParsingState
): void {
    if (text.length)
        state.textSubsectionTokens[at] = {
            text,
            at,
            type,
            modifiers,
        };
}
