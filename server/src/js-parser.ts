import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import { TextDocument } from "vscode-languageserver-textdocument";

import { createLocationFor } from "./parser";
import {
    StoryFormatParsingState,
    capturePreSemanticTokenFor,
} from "./passage-text-parsers";
import { Label } from "./project-index";
import { ETokenType, TokenModifier, TokenType } from "./semantic-tokens";

/**
 * Conversion from Javascript typeof string to semantic token type.
 */
const typeofToSemantic: Record<string, TokenType> = {
    string: ETokenType.string,
    number: ETokenType.number,
    boolean: ETokenType.keyword,
};

interface astUnprocessedToken {
    text: string;
    at: number;
    type: TokenType;
    scope?: string;
    modifiers: TokenModifier[];
}

/**
 * Label for a parsed javascript property.
 */
export interface JSPropertyLabel extends Label {
    /**
     * The property's prefix, if known. A reference for `subprop` from `var.prop.subprop` will
     * have a prefix of `var.prop`.
     */
    prefix?: string;
}
export namespace JSPropertyLabel {
    /**
     * Type guard for JSPropertyLabel.
     */
    export function is(val: unknown): val is JSPropertyLabel {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as JSPropertyLabel).prefix !== undefined;
    }
}

let currentExpression: string = "";
let unprocessedTokens: Record<number, astUnprocessedToken> = {};

const builtInJSObjects = new Set([
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Error",
    "Number",
    "BigInt",
    "Math",
    "Date",
    "String",
    "Array",
    "Map",
    "Set",
    "WeakMap",
    "WeakSet",
    "ArrayBuffer",
    "SharedArrayBuffer",
    "DataView",
    "Atomics",
    "JSON",
]);

/**
 * Determine the scope of a property.
 *
 * A member expression for `subprop` from `var.prop.subprop` will result in a scope of `var.prop`.
 *
 * If the scope includes any computed proeprties (i.e. `var['prop'].subprop`) then no scope
 * will be returned.
 *
 * @param node Member expression node containing the property.
 * @returns The property's scope, or undefined if it can't be statically determined.
 */
function propertyScope(node: acorn.MemberExpression): string | undefined {
    const scope: string[] = [];
    while (node.object.type === "MemberExpression") {
        node = node.object;
        // Give up if we hit a computed or non-identifier property
        if (node.computed || node.property.type !== "Identifier")
            return undefined;
        scope.push(node.property.name);
    }
    if (node.object.type !== "Identifier") return undefined;
    scope.push(node.object.name);
    return scope.reverse().join(".");
}

/**
 * Callback at each node in the AST, capturing tokens of interest.
 *
 * @param rawNode Current node.
 * @param state Parsing state.
 * @param ancestors List of ancestor nodes (including the current one).
 */
function fullAncestorTokenizingCallback(
    rawNode: acorn.Node,
    _: unknown,
    ancestors: acorn.Node[]
): void {
    // We end up setting semantic tokens for some nodes multiple times (for
    // example, an Identifier and then again for a property that's an identifier).
    // We don't worry about that, though, because the walker visits the bottom-most
    // node first, then moves up to the containing expression or property, and the
    // last-set semantic token is the one that's reported.

    const node = rawNode as acorn.AnyNode;
    if (node.type === "Identifier") {
        const ancestor = ancestors[ancestors.length - 2];
        // Don't record placeholders, instantiated classes, function names, or built-in objects
        if (
            node.name !== "✖" &&
            ancestor?.type !== "NewExpression" &&
            ancestor?.type !== "CallExpression" &&
            !builtInJSObjects.has(node.name)
        ) {
            unprocessedTokens[node.start] = {
                text: node.name,
                at: node.start,
                type: ETokenType.variable,
                modifiers: [],
            };
        }
    } else if (node.type === "Literal" && node.raw !== undefined) {
        const semanticType = typeofToSemantic[typeof node.value];
        if (semanticType !== undefined) {
            unprocessedTokens[node.start] = {
                text: node.raw,
                at: node.start,
                type: semanticType,
                modifiers: [],
            };
        }
    } else if (
        node.type === "AssignmentExpression" ||
        node.type === "BinaryExpression" ||
        node.type === "LogicalExpression"
    ) {
        const at = currentExpression.indexOf(node.operator, node.left.end);
        unprocessedTokens[at] = {
            text: node.operator,
            at: at,
            type: ETokenType.operator,
            modifiers: [],
        };
    } else if (node.type === "CallExpression") {
        if (node.callee.type === "Identifier") {
            unprocessedTokens[node.callee.start] = {
                text: node.callee.name,
                at: node.callee.start,
                type: ETokenType.function,
                modifiers: [],
            };
        } else if (
            node.callee.type === "MemberExpression" &&
            node.callee.property.type === "Identifier"
        ) {
            unprocessedTokens[node.callee.property.start] = {
                text: node.callee.property.name,
                at: node.callee.property.start,
                type: ETokenType.function,
                modifiers: [],
            };
        }
    } else if (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.property.type === "Identifier"
    ) {
        const token: astUnprocessedToken = {
            text: node.property.name,
            at: node.property.start,
            type: ETokenType.property,
            modifiers: [],
        };
        const scope = propertyScope(node);
        if (scope !== undefined) {
            const varName = scope.split(".", 1)[0];
            // Don't save a property belonging to a built-in function
            if (builtInJSObjects.has(varName)) return;
            token.scope = scope;
        }
        unprocessedTokens[token.at] = token;
    } else if (
        node.type === "UnaryExpression" ||
        node.type === "UpdateExpression"
    ) {
        const at = node.prefix ? node.start : node.end - node.operator.length;
        unprocessedTokens[at] = {
            text: node.operator,
            at: at,
            type: ETokenType.operator,
            modifiers: [],
        };
    } else if (node.type === "Property" && node.key.type === "Identifier") {
        unprocessedTokens[node.start] = {
            text: node.key.name,
            at: node.start,
            type: ETokenType.property,
            modifiers: [],
        };
    } else if (node.type === "VariableDeclaration") {
        unprocessedTokens[node.start] = {
            text: node.kind,
            at: node.start,
            type: ETokenType.keyword,
            modifiers: [],
        };
    }
}

/**
 * Parse text as a JavaScript program or expression.
 *
 * This performs strict parsing, and throws SyntaxError if the program doesn't parse correctly.
 *
 * A program has to have full statements. An expression can be just a snippet.
 *
 * @param text Text to parse as JavaScript.
 * @param isProgram Whether the text is a full program or just an expression.
 * @returns Top-most node in the AST.
 */
export function parseJSStrict(text: string, isProgram: boolean): acorn.Node {
    if (isProgram) {
        return acorn.parse(text, {
            ecmaVersion: 2020,
            sourceType: "script",
        });
    } else {
        return acorn.parseExpressionAt(text, 0, {
            ecmaVersion: 2020,
            sourceType: "script",
        });
    }
}

/**
 * Parse a JavaScript program or expression.
 *
 * This performs strict parsing (first a full parse, then as an expression), then loose parsing,
 * and does not throw an exception.
 *
 * @param text Text to parse as JavaScript.
 * @param isProgram Whether to parse it as a full JS program or a small expression
 * @returns Top-most node in the AST, or undefined if the parsing failed.
 */
export function parseJS(
    text: string,
    isProgram: boolean
): acorn.Node | undefined {
    try {
        return parseJSStrict(text, isProgram);
    } catch (err) {
        if (!(err instanceof SyntaxError)) {
            return undefined;
        }
    }

    // Finally try whatever parsing we can get away with
    return acornLoose.parse(text, {
        ecmaVersion: 2020,
    });
}

/**
 * Tokenize parsed JavaScript.
 *
 * @param text Original unparsed text.
 * @param ast Parsed text.
 * @returns Object whose keys are the token's location in the unparsed text and whose values are unprocessed tokens.
 */
export function tokenizeParsedJS(
    text: string,
    ast: acorn.Node
): Record<number, astUnprocessedToken> {
    currentExpression = text;
    unprocessedTokens = {};

    acornWalk.fullAncestor(ast, fullAncestorTokenizingCallback);

    return { ...unprocessedTokens };
}

/**
 * Tokenize a JavaScript program or expression and find referenced variables and properties in it.
 *
 * Returned properties are only those for which the parser could trace their "ownership"
 * back to a root variable.
 *
 * @param isProgram Whether to parse it as a program (true) or expression (false).
 * @param text Text to parse.
 * @param offset Offset into the document where the expression occurs.
 * @param document Document containing the expression.
 * @param storyFormatState Story format parsing state that will collect semantic tokens.
 * @returns Two-tuple with separate lists of variable and property labels found in parsing.
 */
export function tokenizeJavaScript(
    isProgram: boolean,
    text: string,
    offset: number,
    document: TextDocument,
    storyFormatState: StoryFormatParsingState
): [Label[], JSPropertyLabel[]] {
    const vars: Label[] = [];
    const props: JSPropertyLabel[] = [];

    const ast = parseJS(text, isProgram);
    if (ast !== undefined) {
        const tokens = tokenizeParsedJS(text, ast);

        for (const token of Object.values(tokens)) {
            if (token.type === ETokenType.variable) {
                vars.push({
                    contents: token.text,
                    location: createLocationFor(
                        token.text,
                        offset + token.at,
                        document
                    ),
                });
            } else if (
                token.type === ETokenType.property &&
                token.scope !== undefined
            ) {
                props.push({
                    contents: token.text,
                    location: createLocationFor(
                        token.text,
                        offset + token.at,
                        document
                    ),
                    prefix: token.scope,
                });
            }
            capturePreSemanticTokenFor(
                token.text,
                offset + token.at,
                token.type,
                token.modifiers,
                storyFormatState
            );
        }
    }

    return [vars, props];
}
