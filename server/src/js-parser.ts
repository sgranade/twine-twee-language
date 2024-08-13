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

const astParser: acornWalk.SimpleVisitors<unknown> = {
    Identifier(node) {
        // Don't record placeholders
        if (node.name !== "✖") {
            unprocessedTokens.push({
                text: node.name,
                at: node.start,
                type: ETokenType.variable,
                modifiers: [],
            });
        }
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
    Property(node, state) {
        if (node.key.type === "Literal" && this.Literal !== undefined) {
            this.Literal(node.key, state);
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
    VariableDeclaration(node) {
        unprocessedTokens.push({
            text: node.kind,
            at: node.start,
            type: ETokenType.variable,
            modifiers: [],
        });
    },
};

/**
 * Parse an expression as a JavaScript string.
 *
 * @param expression Expression to parse.
 * @param offset Offset into the document where the expression occurs.
 * @param state Parsing state.
 * @param passageState Passage state object that will collect tokens.
 * @returns List of variable labels found in parsing.
 */
export function parseJSExpression(
    expression: string,
    offset: number,
    state: ParsingState,
    passageState: StoryFormatParsingState
): Label[] {
    let ast: acorn.Node | undefined;
    const labels: Label[] = [];

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
            if (token.type === ETokenType.variable) {
                labels.push({
                    contents: token.text,
                    location: createLocationFor(
                        token.text,
                        offset + token.at,
                        state
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
