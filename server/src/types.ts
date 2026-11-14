import { Diagnostic, Location } from "vscode-languageserver";

import { DiagnosticCode } from "@tt3/shared";

/**
 * A label, which has a name and a location.
 */
export interface Label {
    contents: string;
    location: Location;
}

/**
 * Twine diagnostic.
 */
export interface TwineDiagnostic extends Diagnostic {
    code: DiagnosticCode;
}

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
