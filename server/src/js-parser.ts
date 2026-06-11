import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { improveAcornErrorMessage } from "./acorn-errors";
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
    scope?: string; // Token scope for properties (e.g. for `prop2` in `var.prop1.prop2`, it's `var.prop1`)
    defined?: boolean; // Is the token being defined?
    global?: boolean; // Is the token at the global level of the AST? (for variables/properties)
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

/**
 * Errors from javascript parsing.
 */
export interface JSDiagnostic {
    /**
     * Contents that the diagnostic refers to.
     */
    contents: string;
    /**
     * Index in the document where the diagnostic occurs.
     */
    at: number;
    message: string;
    severity: DiagnosticSeverity;
}

/**
 * Results of tokenizing JavaScript
 */
export interface TokenizedJS {
    variables: JSVariableLabel[];
    properties: JSPropertyLabel[];
    error?: JSDiagnostic;
}

let currentExpression: string = "";
let unprocessedTokens: Record<number, astUnprocessedToken> = {};

const builtInObjects = new Set([
    // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Error",
    "Number",
    "BigInt",
    "Math",
    "Date",
    "Temporal",
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
    "WeakRef",
    "FinalizationRegistry",
    "Iterator",
    "AsyncIterator",
    "Promise",
    "GeneratorFunction",
    "AsyncGeneratorFunction",
    "Generator",
    "AsyncGenerator",
    "AsyncFunction",
    "DisposableStack",
    "AsyncDisposableStack",
    "Reflect",
    "Proxy",
    "Intl",
    // These next are actually keywords
    "undefined",
    "null,",
    // Commonly-referred-to API objects
    "console",
    "document",
    "window",
]);

// This is hacky, but we're going to ignore root properties whose names
// match static properties of built-in objects' instances.
// Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const builtInJSObjectInstanceProperties = new Set([
    "prototype", // Object
    "arguments", // Function
    "caller", // Function
    "length", // Function, String, Array
    "name", // Function, Error
    "description", // Symbol
    "cause", // Error
    "message", // Error
    "dotAll", // RegExp
    "flags", // RegExp
    "global", // RegExp
    "hasIndices", // RegExp
    "ignoreCase", // RegExp
    "multiline", // RegExp
    "source", // RegExp
    "sticky", // RegExp
    "unicode", // RegExp
    "unicodeSets", // RegExp
    "lastIndex", // RegExp
    "size", // Map
    "byteLength", // ArrayBuffer, SharedArrayBuffer, DataView
    "detached", // ArrayBuffer
    "maxByteLength", // ArrayBuffer, SharedArrayBuffer
    "resizable", // ArrayBuffer
    "growable", // SharedArrayBuffer
    "buffer", // DataView
    "byteOffset", // DataView
    "disposed", // DisposableStack, AsyncDisposableStack
]);

/**
 * Scope in which identifiers will be found and bound.
 */
interface Scope {
    type: "global" | "function" | "block";
    parent?: Scope;
    bindings: Set<string>;
}

/**
 * Add scope information to an Acorn identifier.
 */
interface ScopedIdentifier extends acorn.Identifier {
    _isDefinition?: boolean;
    _scopeType?: "global" | "function" | "block";
}

/**
 * Create a scope.
 *
 * @param type Type of scope to create.
 * @param parent The new scope's parent, if any.
 */
function createScope(type: Scope["type"], parent?: Scope): Scope {
    return {
        type,
        parent,
        bindings: new Set(),
    };
}

/**
 * Get the function (or global) scope that contains a block.
 */
function nearestFunctionScope(scope: Scope): Scope {
    let current = scope;

    while (current.type === "block") {
        current = current.parent!; // Blocks should always have parents
    }

    return current;
}

/**
 * Bind a declared identifier.
 *
 * @param scope Scope in which to declare the binding.
 * @param name Identifier name.
 * @param kind Kind of binding.
 * @returns Scope to which the identifier was bound.
 */
function bindIdentifier(
    scope: Scope,
    name: string,
    kind:
        | "var"
        | "let"
        | "const"
        | "param"
        | "function"
        | "using"
        | "await using",
): Scope {
    const target = kind === "var" ? nearestFunctionScope(scope) : scope;

    target.bindings.add(name);

    return target;
}

/**
 * Find the scope to which an identifier is bound.
 *
 * @param scope Scope to start with.
 * @param name Identifier to find.
 * @returns Scope to which the identifier is bound, or undefined if none.
 */
function findBindingScope(scope: Scope, name: string): Scope | undefined {
    let current: Scope | undefined = scope;

    while (current) {
        if (current.bindings.has(name)) {
            return current;
        }

        current = current.parent;
    }

    return undefined;
}

/**
 * Collect identifiers from patterns such as destructuring and function params.
 *
 * @param pattern Pattern to collect identifiers from.
 * @param callback Visitor function to call when an identifier is found.
 */
function collectPatternIdentifiers(
    pattern: acorn.AnyNode,
    callback: (id: acorn.Identifier) => void,
): void {
    switch (pattern.type) {
        case "Identifier":
            callback(pattern as ScopedIdentifier);
            break;

        case "ObjectPattern":
            for (const prop of pattern.properties) {
                if (prop.type === "Property") {
                    collectPatternIdentifiers(
                        prop.value as acorn.AnyNode,
                        callback,
                    );
                } else {
                    collectPatternIdentifiers(
                        prop.argument as acorn.AnyNode,
                        callback,
                    );
                }
            }
            break;

        case "ArrayPattern":
            for (const element of pattern.elements) {
                if (element) {
                    collectPatternIdentifiers(
                        element as acorn.AnyNode,
                        callback,
                    );
                }
            }
            break;

        case "AssignmentPattern":
            collectPatternIdentifiers(pattern.left, callback);
            break;

        case "RestElement":
            collectPatternIdentifiers(pattern.argument, callback);
            break;
    }
}

/**
 * Is an identifier a reference (i.e. not a declaration or a parameter)?
 *
 * @param node Node to test.
 * @param ancestors Node's ancestors.
 * @returns True if the identifier is a reference.
 */
function isReferenceIdentifier(
    node: acorn.AnyNode,
    ancestors: acorn.Node[],
): boolean {
    const parent = ancestors[ancestors.length - 2] as acorn.AnyNode | undefined;

    // Consider parent-less identifiers as a reference for times when we just parse the tiniest snippet
    if (!parent) return true;

    switch (parent.type) {
        case "VariableDeclarator":
            return parent.id !== node;

        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            if (parent.id === node) return false; // function name is a definition
            return !parent.params.includes(node as acorn.Pattern); // parameter is (maybe) a definition

        case "Property":
            if (parent.key === node && !parent.computed) return false; // static key isn't a reference
            return true;

        case "MemberExpression":
            if (parent.property === node && !parent.computed) return false; // Non-computed property key
            return true;

        case "CatchClause":
            if (parent.param === node) return false;
            return true;

        case "LabeledStatement":
        case "BreakStatement":
        case "ContinueStatement":
            return false;

        case "ImportSpecifier":
        case "ImportDefaultSpecifier":
        case "ImportNamespaceSpecifier":
            return false;

        default: // Treat all other cases as references
            return true;
    }
}

/**
 * Annotate variable definitions or references along with their scope.
 *
 * @param ast AST to annotate.
 */
export function annotateVariableScopes(
    ast: acorn.Node,
    assignmentIsDefinition: boolean,
) {
    const globalScope = createScope("global");

    function visit(node: acorn.AnyNode, scope: Scope, ancestors: acorn.Node[]) {
        switch (node.type) {
            case "Program":
            case "BlockStatement": {
                const newScope =
                    node.type === "BlockStatement"
                        ? createScope("block", scope)
                        : scope;
                for (const child of node.body)
                    visit(child, newScope, [...ancestors, node]);
                return;
            }

            case "FunctionDeclaration": {
                if (node.id) {
                    const boundScope = bindIdentifier(
                        scope,
                        node.id.name,
                        "function",
                    );
                    (node.id as ScopedIdentifier)._isDefinition = true;
                    (node.id as ScopedIdentifier)._scopeType = boundScope.type;
                }
                const fnScope = createScope("function", scope);
                for (const param of node.params) {
                    collectPatternIdentifiers(param as acorn.AnyNode, (id) => {
                        bindIdentifier(fnScope, id.name, "param");
                    });
                }
                visit(node.body, fnScope, [...ancestors, node]);
                return;
            }

            case "FunctionExpression":
            case "ArrowFunctionExpression": {
                const fnScope = createScope("function", scope);
                for (const param of node.params) {
                    collectPatternIdentifiers(param as acorn.AnyNode, (id) => {
                        bindIdentifier(fnScope, id.name, "param");
                    });
                }
                visit(node.body, fnScope, [...ancestors, node]);
                return;
            }

            case "VariableDeclaration": {
                for (const decl of node.declarations) {
                    collectPatternIdentifiers(
                        decl.id as acorn.AnyNode,
                        (id) => {
                            const boundScope = bindIdentifier(
                                scope,
                                id.name,
                                node.kind,
                            );
                            (id as ScopedIdentifier)._isDefinition = true;
                            (id as ScopedIdentifier)._scopeType =
                                boundScope.type;
                        },
                    );
                    if (decl.init)
                        visit(decl.init, scope, [...ancestors, node]);
                }
                return;
            }

            case "Identifier": {
                const idNode = node as ScopedIdentifier;
                if (!isReferenceIdentifier(node, ancestors)) break;

                const resolved = findBindingScope(scope, node.name);
                // The identifier is a reference...
                idNode._isDefinition = false;
                idNode._scopeType = resolved?.type ?? "global";

                // ...unless it's the LHS of an assignment and we're forcing assignment to be definition
                if (assignmentIsDefinition) {
                    const parent = ancestors[ancestors.length - 1] as
                        | acorn.AnyNode
                        | undefined;
                    if (
                        parent &&
                        parent.type === "AssignmentExpression" &&
                        parent.left === node
                    ) {
                        idNode._isDefinition = true;
                    }
                }
                break;
            }
        }

        // Recursively visit all children
        for (const key in node) {
            const child = (node as any)[key];
            if (!child || typeof child !== "object") continue;
            if (Array.isArray(child)) {
                for (const c of child) {
                    if (c && typeof c === "object" && "type" in c)
                        visit(c as acorn.AnyNode, scope, [...ancestors, node]);
                }
            } else if ("type" in child) {
                visit(child as acorn.AnyNode, scope, [...ancestors, node]);
            }
        }
    }

    visit(ast as acorn.AnyNode, globalScope, []);
}

/**
 * Helper type for capturing the variable and all properties in a MemberExpression.
 */
type MemberChain = {
    root: ScopedIdentifier;
    properties: { name: string; start: number }[];
    dynamic: boolean; // true if the chain includes any non-static computed property
};

/**
 * Does a property's scope correspond to a built-in JS object?
 *
 * @param scope Scope to inspect.
 * @returns True if the scope is for a built-in JS object.
 */
function isBuiltinObjectScope(scope: string): boolean {
    return builtInObjects.has(scope.split(".", 1)[0]);
}

/**
 * Does a property correspond to a built-in JS object's instance property?
 *
 * @param property Property to inspect, including full path (e.g. `var.prop1.prop2` for `prop2`).
 * @returns True if the property matches a built-in JS object's instance property.
 */
export function isBuiltinJSObjectInstanceProperty(property: string): boolean {
    return builtInJSObjectInstanceProperties.has(
        property.split(".").pop() || "",
    );
}

/**
 * Get the static name of a node that is a property.
 *
 * @param property Node that contains the property.
 * @param computed Whether the property is a computed one.
 * @returns The static property name, or undefined if the property is computed and non-static.
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
 * Get all of the members of a member expression.
 *
 * @param node Member expression to capture all members.
 * @returns The chain of members, or undefined if an unhandleable object type is encountered in the expression.
 */
function captureMemberChain(
    node: acorn.MemberExpression,
): MemberChain | undefined {
    const props: { name: string; start: number }[] = [];
    let current: acorn.Expression | acorn.Super = node;
    let root: ScopedIdentifier | undefined;
    let dynamic = false;

    while (true) {
        if (current.type === "MemberExpression") {
            // Capture the property
            const propName = getStaticPropertyName(
                current.property,
                current.computed,
            );
            if (!propName) dynamic = true;
            const start =
                current.computed &&
                current.property.type === "Literal" &&
                typeof current.property.value === "string"
                    ? current.property.start + 1
                    : current.property.start;

            props.unshift({ name: propName ?? "<dynamic>", start });
            current = current.object; // Head up the chain in the expression
        } else if (current.type === "Identifier") {
            // This is the variable at the root
            root = current as ScopedIdentifier;
            break;
        } else {
            return undefined; // Don't handle other object types
        }
    }

    if (!root) return undefined;
    return { root: root, properties: props, dynamic };
}

/**
 * Recursively capture all properties in an object expression.
 *
 * @param node ObjectExpression node.
 * @param parentScope Parent scope for the object expression.
 * @param capturePropertyCallback Callback for capturing a property's token.
 */
function captureObjectExpressionProperties(
    node: acorn.ObjectExpression,
    parentScope: string,
    capturePropertyCallback: (
        name: string,
        start: number,
        scope?: string,
        defined?: boolean,
    ) => void,
) {
    const isBuiltinObject = isBuiltinObjectScope(parentScope);

    for (const prop of node.properties) {
        if (prop.type !== "Property") continue; // We only care about properties

        const propName = getStaticPropertyName(
            prop.key,
            prop.computed ?? false,
        );
        if (!propName) continue;

        // Capture the property. Note we blank out the scope for built-in objects
        // so their properties get semantic tokens but aren't otherwise tracked
        capturePropertyCallback(
            propName,
            prop.key.start,
            isBuiltinObject ? undefined : parentScope,
            true,
        );

        // Recurse for contained object literals
        if (prop.value.type === "ObjectExpression") {
            // Compute new scope including this property
            const newScope = parentScope
                ? `${parentScope}.${propName}`
                : propName;

            captureObjectExpressionProperties(
                prop.value,
                newScope,
                capturePropertyCallback,
            );
        }
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

    // Helper function to add a variable to unprocessed tokens if it's not a built-in JS object
    const captureVariable = (id: ScopedIdentifier) => {
        if (!id.name || builtInObjects.has(id.name)) return;
        unprocessedTokens[id.start] = {
            text: id.name,
            at: id.start,
            type: ETokenType.variable,
            defined: !!id._isDefinition,
            global: id._scopeType === "global",
            modifiers: [],
        };
    };

    // Helper function to add a property to unprocessed tokens if it's not dynamic
    const captureProperty = (
        name: string,
        start: number,
        scope?: string,
        defined = false,
    ) => {
        if (!name || name === "<dynamic>") return;
        unprocessedTokens[start] = {
            text: name,
            at: start,
            type: ETokenType.property,
            scope,
            defined,
            modifiers: [],
        };
    };

    const node = rawNode as acorn.AnyNode;
    switch (node.type) {
        case "Identifier": {
            const ancestor = ancestors[ancestors.length - 2];
            // Don't record placeholders, instantiated classes, function names, or built-in objects
            if (
                node.name !== "✖" &&
                ancestor?.type !== "NewExpression" &&
                ancestor?.type !== "CallExpression" &&
                ancestor?.type !== "FunctionExpression" &&
                ancestor?.type !== "FunctionDefinition" &&
                ancestor?.type !== "FunctionDeclaration" &&
                !builtInObjects.has(node.name)
            ) {
                captureVariable(node as ScopedIdentifier);
            }
            break;
        }

        case "Literal": {
            if (node.raw !== undefined) {
                const semanticType = typeofToSemantic[typeof node.value];
                if (semanticType !== undefined) {
                    unprocessedTokens[node.start] = {
                        text: node.raw,
                        at: node.start,
                        type: semanticType,
                        modifiers: [],
                    };
                }
            }
            break;
        }

        case "AssignmentExpression":
        case "BinaryExpression":
        case "LogicalExpression": {
            const at = currentExpression.indexOf(node.operator, node.left.end);
            unprocessedTokens[at] = {
                text: node.operator,
                at: at,
                type: ETokenType.operator,
                modifiers: [],
            };
            break;
        }

        case "CallExpression": {
            if (node.callee.type === "Identifier") {
                unprocessedTokens[node.callee.start] = {
                    text: node.callee.name,
                    at: node.callee.start,
                    type: ETokenType.function,
                    modifiers: [],
                };
            } else if (node.callee.type === "MemberExpression") {
                const chain = captureMemberChain(node.callee);
                if (chain && chain.properties) {
                    const lastProp =
                        chain.properties[chain.properties.length - 1];
                    unprocessedTokens[node.callee.property.start] = {
                        text: lastProp.name,
                        at: lastProp.start,
                        type: ETokenType.function,
                        modifiers: [],
                    };
                }
            }
            break;
        }

        case "UnaryExpression":
        case "UpdateExpression": {
            const at = node.prefix
                ? node.start
                : node.end - node.operator.length;
            unprocessedTokens[at] = {
                text: node.operator,
                at: at,
                type: ETokenType.operator,
                modifiers: [],
            };
            break;
        }

        case "MemberExpression": {
            const chain = captureMemberChain(node);
            if (!chain) break;

            // If the root isn't in the global scope, bail out
            if (chain.root._scopeType !== "global") {
                break;
            }

            const defined = isMemberExpressionDefinition(node, ancestors);
            const isBuiltin = isBuiltinObjectScope(chain.root.name);

            // Add the root variable
            captureVariable(chain.root);

            // Track dynamic properties incrementally
            let dynamicEncountered = false;

            // Don't capture any properties
            chain.properties.forEach((prop, i) => {
                if (prop.name === "<dynamic>") {
                    dynamicEncountered = true;
                    return; // Skip capturing dynamic property itself
                }

                // Scope is valid only until the first dynamic property
                const scope =
                    !dynamicEncountered && !isBuiltin
                        ? [
                              chain.root.name,
                              ...chain.properties
                                  .slice(0, i)
                                  .map((p) => p.name),
                          ].join(".")
                        : undefined;

                // Only count the property as defined if it's being defined on a global variable
                captureProperty(
                    prop.name,
                    prop.start,
                    scope,
                    defined && chain.root._scopeType === "global",
                );
            });
            break;
        }

        case "Property": {
            const propName = getStaticPropertyName(
                node.key,
                node.computed ?? false,
            );
            // If we're a non-static property, bail out
            if (!propName) break;

            // Find the parent scope (if any) for the property
            let parentScope: string | undefined;

            for (let i = ancestors.length - 2; i >= 0; i--) {
                const ancestor = ancestors[i] as acorn.AnyNode;

                // var.prop1.prop2... = { ... } (for any number of properties)
                if (
                    ancestor.type === "AssignmentExpression" &&
                    ancestor.right.type === "ObjectExpression"
                ) {
                    // Get the scope from the left side to prepend to the property scopes
                    const left = ancestor.left;
                    if (left.type === "Identifier") {
                        if (
                            (left as ScopedIdentifier)._scopeType === "global"
                        ) {
                            parentScope = left.name;
                            captureObjectExpressionProperties(
                                ancestor.right,
                                parentScope,
                                captureProperty,
                            );
                        }
                        break;
                    } else if (left.type === "MemberExpression") {
                        const chain = captureMemberChain(left);
                        if (
                            chain &&
                            !chain.dynamic &&
                            chain.root._scopeType === "global"
                        ) {
                            // If it's dynamic, then we don't save the properties
                            parentScope = [
                                chain.root.name,
                                ...chain.properties.map((p) => p.name),
                            ].join(".");
                            captureObjectExpressionProperties(
                                ancestor.right,
                                parentScope,
                                captureProperty,
                            );
                            break;
                        }
                    }
                }

                // const obj = { ... }
                if (
                    ancestor.type === "VariableDeclarator" &&
                    ancestor.id.type === "Identifier" &&
                    ancestor.init?.type === "ObjectExpression"
                ) {
                    const id = ancestor.id as ScopedIdentifier;

                    if (id._scopeType === "global") {
                        parentScope = id.name;
                        captureObjectExpressionProperties(
                            ancestor.init,
                            parentScope,
                            captureProperty,
                        );
                    }
                    break;
                }
            }

            // Capture the property. Note we blank out the scope for built-in objects
            // so their properties get semantic tokens but aren't otherwise tracked
            captureProperty(
                propName,
                node.key.start,
                isBuiltinObjectScope(parentScope || "")
                    ? undefined
                    : parentScope || undefined,
                true,
            );
            break;
        }

        case "VariableDeclaration": {
            unprocessedTokens[node.start] = {
                text: node.kind,
                at: node.start,
                type: ETokenType.keyword,
                modifiers: [],
            };
            break;
        }
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
): [acorn.Node | undefined, JSDiagnostic | undefined] {
    // Don't do anything if no text is passed (as that would create an error)
    if (!text.trim()) return [undefined, undefined];

    let diagnostic: JSDiagnostic | undefined;
    try {
        return [parseJSStrict(text, isProgram), undefined];
    } catch (err) {
        if (!(err instanceof SyntaxError)) {
            return [undefined, undefined];
        }
        diagnostic = {
            ...improveAcornErrorMessage(
                text,
                err as SyntaxError & {
                    pos?: number;
                    loc?: {
                        line: number;
                        column: number;
                    };
                },
            ),
            severity: DiagnosticSeverity.Error,
        };
    }

    // Finally try whatever parsing we can get away with
    return [
        acornLoose.parse(text, {
            ecmaVersion: 2020,
        }),
        diagnostic,
    ];
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
 * @param assignmentIsDefinition If true, variable assignment will be treated as variable definition. (Needed for e.g. SugarCube passage link setters.)
 * @returns Tokenized variables and properties and any parsing error.
 */
export function tokenizeJavaScript(
    isProgram: boolean,
    text: string,
    offset: number,
    document: TextDocument,
    storyFormatState: StoryFormatParsingState,
    assignmentIsDefinition?: boolean,
): TokenizedJS {
    const tokenized: TokenizedJS = {
        variables: [],
        properties: [],
    };

    const [ast, diagnostic] = parseJS(text, isProgram);
    tokenized.error = diagnostic;
    if (ast !== undefined) {
        annotateVariableScopes(ast, !!assignmentIsDefinition);

        const tokens = tokenizeParsedJS(text, ast);

        for (const token of Object.values(tokens)) {
            // Capture global variables
            if (token.type === ETokenType.variable && token.global) {
                tokenized.variables.push({
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
                tokenized.properties.push({
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
    if (tokenized.error !== undefined) {
        tokenized.error.at += offset;
    }

    return tokenized;
}
