import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";

import {
    StoryFormatParsingState,
    capturePreTokenFor,
} from "./passage-text-parsers";
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

const astParser: acornWalk.SimpleVisitors<unknown> = {
    Identifier(node) {
        unprocessedTokens.push({
            text: node.name,
            at: node.start,
            type: ETokenType.variable,
            modifiers: [],
        });
    },
    Literal(node) {
        if (node.raw !== undefined) {
            const semanticType = typeofToSemantic[typeof node.value];
            if (semanticType !== undefined) {
                unprocessedTokens.push({
                    text: node.raw,
                    at: node.start,
                    type: semanticType,
                    modifiers: [],
                });
            }
        }
    },
    AssignmentExpression(node) {
        unprocessedTokens.push({
            text: node.operator,
            at: currentExpression.indexOf(node.operator, node.left.end),
            type: ETokenType.operator,
            modifiers: [],
        });
    },
    BinaryExpression(node) {
        unprocessedTokens.push({
            text: node.operator,
            at: currentExpression.indexOf(node.operator, node.left.end),
            type: ETokenType.operator,
            modifiers: [],
        });
    },
    CallExpression(node) {
        const callee = node.callee as acorn.Identifier;
        if (callee.name !== undefined) {
            unprocessedTokens.push({
                text: callee.name,
                at: callee.start,
                type: ETokenType.function,
                modifiers: [],
            });
        }
    },
    LogicalExpression(node) {
        unprocessedTokens.push({
            text: node.operator,
            at: currentExpression.indexOf(node.operator, node.left.end),
            type: ETokenType.operator,
            modifiers: [],
        });
    },
    MemberExpression(node) {
        if (!node.computed) {
            const prop = node.property as acorn.Identifier;
            if (prop.name !== undefined) {
                unprocessedTokens.push({
                    text: prop.name,
                    at: prop.start,
                    type: ETokenType.property,
                    modifiers: [],
                });
            }
        }
    },
    Property(node) {
        if (node.key.type === "Literal" && this.Literal !== undefined) {
            this.Literal(node.key, undefined);
        } else if (node.key.type === "Identifier") {
            unprocessedTokens.push({
                text: node.key.name,
                at: node.start,
                type: ETokenType.property,
                modifiers: [],
            });
        }
    },
    UnaryExpression(node) {
        unprocessedTokens.push({
            text: node.operator,
            at: node.start,
            type: ETokenType.operator,
            modifiers: [],
        });
    },
    UpdateExpression(node) {
        unprocessedTokens.push({
            text: node.operator,
            at: node.start,
            type: ETokenType.operator,
            modifiers: [],
        });
    },
};

/**
 * Parse an expression as a JavaScript string.
 *
 * @param expression Expression to parse.
 * @param offset Offset into the document where the expression occurs.
 * @param passageState Passage state object that will collect tokens.
 */
export function parseJSExpression(
    expression: string,
    offset: number,
    passageState: StoryFormatParsingState
): void {
    let ast: acorn.Node | undefined;

    try {
        ast = acorn.parseExpressionAt(expression, 0, {
            ecmaVersion: 2020,
        });
    } catch (err) {
        if (err instanceof SyntaxError) {
            ast = acornLoose.parse(expression, {
                ecmaVersion: 2020,
            });
        }
    }

    if (ast !== undefined) {
        currentExpression = expression;
        unprocessedTokens = [];

        acornWalk.simple(ast, astParser);

        for (const token of unprocessedTokens) {
            capturePreTokenFor(
                token.text,
                offset + token.at,
                token.type,
                token.modifiers,
                passageState
            );
        }
    }

    return;
}
