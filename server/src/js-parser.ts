import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";

import { createLocationFor, ParsingState } from "./parser";
import {
    StoryFormatParsingState,
    capturePreTokenFor,
} from "./passage-text-parsers";
import { Label } from "./project-index";
import { ETokenType, TokenModifier, TokenType } from "./tokens";

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
    modifiers: TokenModifier[];
}

let currentExpression: string = "";
let unprocessedTokens: astUnprocessedToken[] = [];

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
            unprocessedTokens.push({
                text: node.name,
                at: node.start,
                type: ETokenType.variable,
                modifiers: [],
            });
        }
    } else if (node.type === "Literal" && node.raw !== undefined) {
        const semanticType = typeofToSemantic[typeof node.value];
        if (semanticType !== undefined) {
            unprocessedTokens.push({
                text: node.raw,
                at: node.start,
                type: semanticType,
                modifiers: [],
            });
        }
    } else if (
        node.type === "AssignmentExpression" ||
        node.type === "BinaryExpression" ||
        node.type === "LogicalExpression"
    ) {
        unprocessedTokens.push({
            text: node.operator,
            at: currentExpression.indexOf(node.operator, node.left.end),
            type: ETokenType.operator,
            modifiers: [],
        });
    } else if (
        node.type === "CallExpression" &&
        node.callee.type === "Identifier"
    ) {
        unprocessedTokens.push({
            text: node.callee.name,
            at: node.callee.start,
            type: ETokenType.function,
            modifiers: [],
        });
    } else if (
        node.type === "MemberExpression" &&
        !node.computed &&
        node.property.type === "Identifier"
    ) {
        unprocessedTokens.push({
            text: node.property.name,
            at: node.property.start,
            type: ETokenType.property,
            modifiers: [],
        });
    } else if (
        node.type === "UnaryExpression" ||
        node.type === "UpdateExpression"
    ) {
        unprocessedTokens.push({
            text: node.operator,
            at: node.prefix ? node.start : node.end - node.operator.length,
            type: ETokenType.operator,
            modifiers: [],
        });
    } else if (node.type === "Property" && node.key.type === "Identifier") {
        unprocessedTokens.push({
            text: node.key.name,
            at: node.start,
            type: ETokenType.property,
            modifiers: [],
        });
    } else if (node.type === "VariableDeclaration") {
        unprocessedTokens.push({
            text: node.kind,
            at: node.start,
            type: ETokenType.variable,
            modifiers: [],
        });
    }
}

/**
 * Parse a JavaScript expression.
 *
 * This performs strict parsing, and throws SyntaxError if the expression isn't valid JS.
 *
 * @param expression Expression to parse as JavaScript.
 * @returns Top-most node in the AST.
 */
export function parseJSExpressionStrict(expression: string): acorn.Expression {
    return acorn.parseExpressionAt(expression, 0, { ecmaVersion: 2020 });
}

/**
 * Parse a JavaScript epxression.
 *
 * This performs strict parsing first, then loose parsing, and does not throw an exception.
 *
 * @param expression Expression to parse as JavaScript.
 * @returns Top-most node in the AST, or undefined if the parsing failed.
 */
export function parseJSExpression(expression: string): acorn.Node | undefined {
    try {
        return parseJSExpressionStrict(expression);
    } catch (err) {
        if (err instanceof SyntaxError) {
            return acornLoose.parse(expression, {
                ecmaVersion: 2020,
            });
        }
    }
    return undefined;
}

/**
 * Tokenize a JavaScript expression and find referenced variables in it.
 *
 * @param expression Expression to parse.
 * @param offset Offset into the document where the expression occurs.
 * @param state Parsing state.
 * @param passageState Passage state object that will collect tokens.
 * @returns List of variable labels found in parsing.
 */
export function tokenizeJSExpression(
    expression: string,
    offset: number,
    state: ParsingState,
    passageState: StoryFormatParsingState
): Label[] {
    const labels: Label[] = [];

    const ast = parseJSExpression(expression);
    if (ast !== undefined) {
        currentExpression = expression;
        unprocessedTokens = [];

        acornWalk.fullAncestor(ast, fullAncestorTokenizingCallback);

        for (const token of unprocessedTokens) {
            if (token.type === ETokenType.variable) {
                labels.push({
                    contents: token.text,
                    location: createLocationFor(
                        token.text,
                        offset + token.at,
                        state.textDocument
                    ),
                });
            }
            capturePreTokenFor(
                token.text,
                offset + token.at,
                token.type,
                token.modifiers,
                passageState
            );
        }
    }

    return labels;
}
