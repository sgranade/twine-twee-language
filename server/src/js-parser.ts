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

/**
 * Unprocessed token from the Javascript AST.
 */
interface astUnprocessedToken {
    text: string; // Actual token text
    at: number; // Token location
    type: TokenType; // Type of the token
    scope?: string; // Token scope for properties (e.g. for `baz` in `foo.bar.baz`, it's `foo.bar`)
    defined?: boolean; // Is the token being defined?
    modifiers: TokenModifier[]; // Modifiers for the token
}

/**
 * Label for a parsed javascript variable.
 */
export interface JSVariableLabel extends Label {
    /**
     * Whether the variable is being defined.
     */
    defined?: boolean;
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
    /**
     * Whether the property is being defined.
     */
    defined?: boolean;
}
export namespace JSPropertyLabel {
    /**
     * Type guard for JSPropertyLabel.
     */
    export function is(val: unknown): val is JSPropertyLabel {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (
            (val as JSPropertyLabel).contents !== undefined &&
            (val as JSPropertyLabel).location !== undefined &&
            ((val as JSPropertyLabel).prefix !== undefined ||
                (val as JSPropertyLabel).defined !== undefined)
        );
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
 * Helper type for capturing the full path of a property's scope.
 */
type ScopePath = {
    root: string;
    path: string[];
};

/**
 * Convert a scope path to a string.
 *
 * @param scope Scope's full path.
 * @returns String representation of the scope path.
 */
function scopePathToString(scope: ScopePath): string {
    return [scope.root, ...scope.path].join(".");
}

/**
 * A member property, including its full scope.
 */
type MemberProperty = {
    name: string;
    at: number;
    scope?: string;
};

/**
 * Get the static name of a property (if it exists).
 *
 * @param property Node that contains the property.
 * @param computed Whether the property is a computed one.
 * @returns The static property name, or undefined if there is none.
 */
function getStaticPropertyName(
    property: acorn.AnyNode,
    computed: boolean,
): string | undefined {
    if (!computed && property.type === "Identifier") {
        return property.name;
    }

    if (
        computed &&
        property.type === "Literal" &&
        typeof property.value === "string"
    ) {
        return property.value;
    }

    return undefined;
}

/**
 * Determine if a node contains a variable definition such as `const var` or `var =`
 *
 * @param node Node being inspected.
 * @param ancestors The node's ancestors.
 * @returns True if the node is defining stuff.
 */
function isDefinitionContext(
    node: acorn.AnyNode,
    ancestors: acorn.Node[],
): boolean {
    const parent = ancestors[ancestors.length - 2] as acorn.AnyNode | undefined;
    if (!parent) {
        return false;
    }

    // var = ...  and var.prop = ...
    if (parent.type === "AssignmentExpression") {
        return parent.left === node;
    }

    // const var = ...
    if (parent.type === "VariableDeclarator") {
        return parent.id === node;
    }

    return false;
}

/**
 * Determine if a member expression is defining stuff (i.e. is part of an assignment expression).
 *
 * @param node Member expression being inspected.
 * @param ancestors The node's ancestors.
 * @returns True if the member expression is defining stuff.
 */
function isMemberExpressionDefinition(
    node: acorn.MemberExpression,
    ancestors: acorn.Node[],
): boolean {
    const parent = ancestors[ancestors.length - 2] as acorn.AnyNode | undefined;
    return parent?.type === "AssignmentExpression" && parent.left === node;
}

/**
 * Get the root identifier of a member expression, if any.
 *
 * @param node Member expression to get the root identifier of.
 * @returns The identifier at the root, or undefined if none.
 */
function getMemberExpressionRootIdentifier(
    node: acorn.MemberExpression,
): acorn.Identifier | undefined {
    let current: acorn.MemberExpression = node;

    while (true) {
        if (current.object.type === "Identifier") {
            return current.object;
        }

        if (current.object.type !== "MemberExpression") {
            return undefined;
        }

        current = current.object;
    }
}

/**
 * Determine the scope of a property in a member expression.
 *
 * A member expression for `subprop` from `var.prop.subprop` will result in a scope of `var.prop`.
 *
 * If the scope includes any computed non-static proeprties (i.e. `var[othervar].subprop`), then no scope
 * will be returned.
 *
 * @param node Member expression node containing the property.
 * @returns The property's scope, or undefined if it can't be statically determined.
 */
function resolveMemberExpressionScope(
    node: acorn.MemberExpression,
): ScopePath | undefined {
    const path: string[] = [];

    let current: acorn.MemberExpression = node;

    // Walk upward through chained member expressions
    while (true) {
        const propName = getStaticPropertyName(
            current.property,
            current.computed,
        );
        if (propName === undefined) {
            return undefined;
        }

        path.unshift(propName);

        if (current.object.type === "Identifier") {
            return {
                root: current.object.name,
                path: path.slice(0, -1), // exclude node's property from the path
            };
        }

        if (current.object.type !== "MemberExpression") {
            return undefined;
        }

        current = current.object;
    }
}

/**
 * Determine the scope of a property in an object property scope.
 *
 * A member expression for `subprop` from `var.prop = {subprop: val}` will result in a scope of `var.prop`.
 *
 * If the scope includes any computed non-static properties (i.e. `var[othervar].subprop`), then no scope
 * will be returned.
 *
 * @param node Member expression node containing the property.
 * @returns The property's scope, or undefined if it can't be statically determined.
 */
function resolveObjectPropertyScope(
    ancestors: acorn.Node[],
): ScopePath | undefined {
    const path: string[] = [];

    // Skip current node
    for (let i = ancestors.length - 2; i >= 0; --i) {
        const ancestor = ancestors[i] as acorn.AnyNode;

        // Parent object property -- save it in the path
        if (ancestor.type === "Property") {
            const propName = getStaticPropertyName(
                ancestor.key,
                ancestor.computed ?? false,
            );
            if (propName === undefined) {
                return undefined;
            }

            path.unshift(propName);
            continue;
        }

        // Assignment target -- grab the left for part of the scope
        if (ancestor.type === "AssignmentExpression") {
            // foo = { ... }
            if (ancestor.left.type === "Identifier") {
                return {
                    root: ancestor.left.name,
                    path,
                };
            }

            // foo.bar = { ... }
            if (ancestor.left.type === "MemberExpression") {
                const memberScope = resolveMemberExpressionScope(ancestor.left);
                if (memberScope === undefined) {
                    return undefined;
                }

                const propName = getStaticPropertyName(
                    ancestor.left.property,
                    ancestor.left.computed,
                );

                return {
                    root: memberScope.root,
                    path: [
                        ...memberScope.path,
                        propName ? propName : "",
                        ...path,
                    ],
                };
            }

            return undefined;
        }

        // const foo = { ... }
        if (ancestor.type === "VariableDeclarator") {
            if (ancestor.id.type === "Identifier") {
                return {
                    root: ancestor.id.name,
                    path,
                };
            }

            return undefined;
        }
    }

    return undefined;
}

/**
 * Capture object properties within a member expression.
 *
 * @param node Node containing the member expression.
 * @returns List of member properties within the expression.
 */
function captureMemberExpressionProperties(
    node: acorn.MemberExpression,
): MemberProperty[] {
    const chain: {
        name: string;
        at: number;
    }[] = [];

    let current: acorn.MemberExpression = node;

    while (true) {
        const propName = getStaticPropertyName(
            current.property,
            current.computed,
        );
        if (propName === undefined) {
            return [];
        }

        // Handle how computed properties' locations start with the quote mark
        let start = current.property.start;
        if (
            current.computed &&
            current.property.type === "Literal" &&
            typeof current.property.value === "string"
        ) {
            start++;
        }

        chain.unshift({
            name: propName,
            at: start,
        });

        if (current.object.type === "Identifier") {
            const root = current.object.name;

            return chain.map((prop, index) => ({
                ...prop,
                scope:
                    index === 0
                        ? root
                        : [
                              root,
                              ...chain.slice(0, index).map((p) => p.name),
                          ].join("."),
            }));
        }

        if (current.object.type !== "MemberExpression") {
            return [];
        }

        current = current.object;
    }
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
    ancestors: acorn.Node[],
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
                defined: isDefinitionContext(node, ancestors),
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
    } else if (node.type === "MemberExpression") {
        const properties = captureMemberExpressionProperties(node);
        const defined = isMemberExpressionDefinition(node, ancestors);

        // The root variable identifier, if any, will have already been marked by
        // this callback as not being part of an expression that defines it. Fix
        // that for any member expression that's a definition.
        if (defined) {
            const root = getMemberExpressionRootIdentifier(node);
            if (root !== undefined && !builtInJSObjects.has(root.name)) {
                const existing = unprocessedTokens[root.start];

                unprocessedTokens[root.start] = {
                    ...(existing ?? {}),
                    text: root.name,
                    at: root.start,
                    type: ETokenType.variable,
                    modifiers: existing?.modifiers ?? [],
                    defined: true,
                };
            }
        }

        for (const property of properties) {
            const root = property.scope?.split(".", 1)[0];
            // Don't capture properties of a built-in JS object
            if (root !== undefined && builtInJSObjects.has(root)) {
                continue;
            }

            unprocessedTokens[property.at] = {
                text: property.name,
                at: property.at,
                type: ETokenType.property,
                modifiers: [],
                scope: property.scope,
                defined: defined,
            };
        }
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
    } else if (node.type === "Property") {
        const propName = getStaticPropertyName(
            node.key,
            node.computed ?? false,
        );
        if (propName === undefined) {
            return;
        }

        const token: astUnprocessedToken = {
            text: propName,
            at: node.key.start,
            type: ETokenType.property,
            modifiers: [],
        };

        const scope = resolveObjectPropertyScope(ancestors);

        if (scope !== undefined) {
            if (builtInJSObjects.has(scope.root)) {
                return;
            }

            token.scope = scopePathToString(scope);
            token.defined = true; // b/c scopes only exist for property definitions
        }

        unprocessedTokens[token.at] = token;
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
    isProgram: boolean,
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
    ast: acorn.Node,
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
    storyFormatState: StoryFormatParsingState,
): [JSVariableLabel[], JSPropertyLabel[]] {
    const vars: JSVariableLabel[] = [];
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
                        document,
                    ),
                    defined: token.defined,
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
                        document,
                    ),
                    prefix: token.scope,
                    defined: token.defined,
                });
            }
            capturePreSemanticTokenFor(
                token.text,
                offset + token.at,
                token.type,
                token.modifiers,
                storyFormatState,
            );
        }
    }

    return [vars, props];
}
