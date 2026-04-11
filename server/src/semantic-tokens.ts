import { SemanticTokensLegend } from "vscode-languageserver";

/**
 * Available semantic token types
 */
export const ETokenType = {
    class: 0,
    property: 1,
    decorator: 2,
    function: 3,
    parameter: 4,
    variable: 5,
    comment: 6,
    keyword: 7,
    string: 8,
    number: 9,
    operator: 10,
    macro: 11,
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
export interface SemanticToken {
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
