/**
 * Token: an identifier and its zero-based index into the containing document.
 */

export interface Token {
    /**
     * Text value of the token.
     */
    text: string;
    /**
     * Index in the document where the token occurs.
     */
    at: number;
}
export namespace Token {
    /**
     * Create a new Token literal.
     * @param text The token's text.
     * @param at The token's index in the document.
     */
    export function create(text: string, at: number): Token {
        return { text: text, at: at };
    }
}
