/**
 * Available semantic token types
 */

import { SemanticTokensLegend } from "vscode-languageserver";

export const ETokenType = {
    class: 0,
    property: 1,
    function: 2,
    parameter: 3,
    variable: 4,
    comment: 5,
    keyword: 6,
    string: 7,
    number: 8,
} as const;
export type TokenType = (typeof ETokenType)[keyof typeof ETokenType];

export const ETokenModifier = {
    declaration: 0b1,
    deprecated: 0b10,
    modification: 0b100,
} as const;
export type TokenModifier =
    (typeof ETokenModifier)[keyof typeof ETokenModifier];

/**
 * Semantic token.
 */
export interface Token {
    line: number;
    char: number;
    length: number;
    tokenType: TokenType;
    tokenModifiers: TokenModifier[];
}

export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: Object.keys(ETokenType),
    tokenModifiers: Object.keys(ETokenModifier),
};
