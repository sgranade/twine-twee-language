import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { improveAcornErrorMessage } from "./acorn-errors";
import { ParserWithState } from "./acorn-errors/parser-state";
import { createLocationFor } from "./parser";
import {
    StoryFormatParsingState,
    capturePreSemanticTokenFor,
} from "./passage-text-parsers";
import { Label } from "./project-index";
import { ETokenType, TokenModifier, TokenType } from "./semantic-tokens";

/**
 * The ECMA version we're going to parse with.
 */
export const EcmaVersion: acorn.ecmaVersion = "latest";

/**
 * Conversion from Javascript typeof string to semantic token type.
 */
const typeofToSemantic: Record<string, TokenType> = {
    string: ETokenType.string,
    number: ETokenType.number,
    boolean: ETokenType.keyword,
};

/**
 * Label for a parsed javascript variable.
 */
export interface JSVariableLabel extends Label {
    /**
     * Whether the variable is being assigned to.
     */
    assigned?: boolean;
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
     * Whether the property is being assigned to.
     */
    assigned?: boolean;
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
                (val as JSPropertyLabel).assigned !== undefined)
        );
    }
}

/**
 * Errors from javascript parsing.
 */
export interface JSDiagnostic {
    /**
     * Start index in the document where the diagnostic occurs.
     */
    start: number;
    /**
     * End index in the document where the diagnostic occurs.
     */
    end: number;
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

// `acorn-loose`'s marker for a missing identifier
const MISSING_IDENTIFIER = "✖";

/**
 * JavaScript global names.
 *
 * Note that browser and library globals come from story formats,
 * as there are some (like `location` or `history`) that they may want
 * to accept so story authors can use them even though they're also
 * browser globals.
 */
const ecmaScriptGlobals: ReadonlySet<string> = new Set([
    // Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
    "Object",
    "Function",
    "Boolean",
    "Symbol",
    "Error",
    "AggregateError",
    "EvalError",
    "RangeError",
    "ReferenceError",
    "SuppressedError",
    "SyntaxError",
    "TypeError",
    "URIError",
    "Number",
    "BigInt",
    "Math",
    "Date",
    "Temporal",
    "String",
    "RegExp",
    "Array",
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "BigInt64Array",
    "BigUint64Array",
    "Float16Array",
    "Float32Array",
    "Float64Array",
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
    // These next are actually keywords (minus `null` b/c it parses
    // as a `Literal`)
    "undefined",
    "NaN",
    "Infinity",
    "globalThis",
    // Function properties
    "parseInt",
    "parseFloat",
    "isNaN",
    "isFinite",
    "encodeURI",
    "encodeURIComponent",
    "decodeURI",
    "decodeURIComponent",
    "escape",
    "unescape",
    "eval",
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
    _isAssignment?: boolean;
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
        | "class"
        | "using"
        | "await using",
): Scope {
    const target = kind === "var" ? nearestFunctionScope(scope) : scope;

    target.bindings.add(name);

    return target;
}

/**
 * Bind a declaration's name and mark the identifier as a definition in the
 * scope it's bound to.
 *
 * @param scope Scope to declare the binding in.
 * @param id Identifier being declared.
 * @param kind Kind of binding.
 */
function bindDeclaredName(
    scope: Scope,
    id: acorn.Identifier,
    kind: Parameters<typeof bindIdentifier>[2],
): void {
    const boundScope = bindIdentifier(scope, id.name, kind);
    (id as ScopedIdentifier)._isAssignment = true;
    (id as ScopedIdentifier)._scopeType = boundScope.type;
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
 * What an identifier's role is: declaration (being bound via `var`/`let`/`const`;
 * function name; parameter), reference (part of a read or write of a name), or neither.
 */
type IdentifierRole = "declaration" | "reference" | "neither";

/**
 * Get a node's immediate parent from its ancestors.
 *
 * The list of ancestors includes the node itself at the end (via the `fullAncestor`
 * acorn-walk setting).
 *
 * @param ancestors Node's ancestors, including the node.
 * @returns The node's parent, or undefined if it has none.
 */
function parentOf(ancestors: acorn.Node[]): acorn.AnyNode | undefined {
    return ancestors[ancestors.length - 2] as acorn.AnyNode | undefined;
}

/**
 * Classify an identifier given its ancestors.
 *
 * @param node Node to classify.
 * @param ancestors Node's ancestors, ending with `node` itself (the
 * acorn-walk `fullAncestor` convention).
 * @returns The identifier's role.
 */
function classifyIdentifier(
    node: acorn.AnyNode,
    ancestors: acorn.Node[],
): IdentifierRole {
    const parent = parentOf(ancestors);

    // Consider parent-less identifiers as a reference for times when we just parse the tiniest snippet
    if (!parent) return "reference";

    switch (parent.type) {
        case "VariableDeclarator":
            return parent.id === node ? "declaration" : "reference";

        case "FunctionDeclaration":
        case "FunctionExpression":
        case "ArrowFunctionExpression":
            if (parent.id === node) return "declaration"; // function name
            if (parent.params.includes(node as acorn.Pattern))
                return "declaration"; // parameter
            return "reference";

        case "Property":
            // Static key isn't a reference or a declaration
            return parent.key === node && !parent.computed
                ? "neither"
                : "reference";

        case "MemberExpression":
            // Non-computed property key -- same reasoning as above
            return parent.property === node && !parent.computed
                ? "neither"
                : "reference";

        case "MethodDefinition":
        case "PropertyDefinition":
            // Non-computed key's a property name, not a variable -- same
            // reasoning as above
            return parent.key === node && !parent.computed
                ? "neither"
                : "reference";

        case "CatchClause":
            return parent.param === node ? "declaration" : "reference";

        case "ClassDeclaration":
        case "ClassExpression":
            return parent.id === node ? "declaration" : "reference";

        case "LabeledStatement":
        case "BreakStatement":
        case "ContinueStatement":
            return "neither"; // label

        case "ImportSpecifier":
        case "ImportDefaultSpecifier":
        case "ImportNamespaceSpecifier":
            return "neither"; // an import binding

        default: // Treat all other cases as references
            return "reference";
    }
}

/**
 * Annotate variable definitions or references along with their scope.
 *
 * @param ast AST to annotate.
 */
function annotateVariableScopes(ast: acorn.Node, isAssignmentContext: boolean) {
    const globalScope = createScope("global");
    const references: { id: ScopedIdentifier; scope: Scope }[] = [];

    /**
     * Visit a function. Its parameters bind in one scope, while its body's
     * declarations, including `var`s, bind in a child of that scope. That
     * prevents a body `var` from being hoisted.
     * : its parameters bind in one scope, and its body's
     * declarations (including hoisted `var`s) in a child of that scope, so
     * parameter defaults can't see body `var`s. A named function
     * expression's name binds in a scope of its own outside both.
     *
     * @param node Function node to visit.
     * @param scope Scope enclosing the function node.
     * @param ancestors Function's ancestors, ending with `node` itself.
     */
    function visitFunction(
        node:
            | acorn.FunctionDeclaration
            | acorn.AnonymousFunctionDeclaration
            | acorn.FunctionExpression
            | acorn.ArrowFunctionExpression,
        scope: Scope,
        ancestors: acorn.Node[],
    ): void {
        let outerScope = scope;
        if (node.id) {
            if (node.type === "FunctionDeclaration") {
                bindDeclaredName(scope, node.id, "function");
            } else {
                outerScope = createScope("block", scope);
                bindDeclaredName(outerScope, node.id, "function");
            }
        }

        const paramScope = createScope("function", outerScope);
        if (node.type !== "ArrowFunctionExpression") {
            bindIdentifier(paramScope, "arguments", "param");
        }
        for (const param of node.params) {
            collectPatternIdentifiers(param as acorn.AnyNode, (id) => {
                bindIdentifier(paramScope, id.name, "param");
            });
        }

        if (node.body.type === "BlockStatement") {
            const bodyScope = createScope("function", paramScope);
            for (const child of node.body.body)
                visit(child, bodyScope, [...ancestors, node.body, child]);
        } else {
            visit(node.body, paramScope, [...ancestors, node.body]);
        }
    }

    /**
     * Visit expressions embedded in a binding pattern -- default values
     * and computed keys -- w/o re-visiting the names it binds.
     *
     * @param pattern Pattern to walk.
     * @param scope Scope the embedded expressions are evaluated in.
     * @param ancestors Pattern's ancestors, ending with `pattern` itself.
     */
    function visitPatternExpressions(
        pattern: acorn.AnyNode,
        scope: Scope,
        ancestors: acorn.Node[],
    ): void {
        const into = (child: acorn.AnyNode, path: acorn.Node[]) =>
            visitPatternExpressions(child, scope, [...ancestors, ...path]);

        switch (pattern.type) {
            case "ObjectPattern":
                for (const prop of pattern.properties) {
                    if (prop.type === "Property") {
                        if (prop.computed)
                            visit(prop.key, scope, [
                                ...ancestors,
                                prop,
                                prop.key,
                            ]);
                        into(prop.value, [prop, prop.value]);
                    } else {
                        into(prop, [prop]);
                    }
                }
                break;

            case "ArrayPattern":
                for (const element of pattern.elements) {
                    if (element) into(element, [element]);
                }
                break;

            case "AssignmentPattern":
                into(pattern.left, [pattern.left]);
                visit(pattern.right, scope, [...ancestors, pattern.right]);
                break;

            case "RestElement":
                into(pattern.argument, [pattern.argument]);
                break;
        }
    }

    function visit(node: acorn.AnyNode, scope: Scope, ancestors: acorn.Node[]) {
        switch (node.type) {
            case "Program":
            case "BlockStatement": {
                const newScope =
                    node.type === "BlockStatement"
                        ? createScope("block", scope)
                        : scope;
                for (const child of node.body)
                    visit(child, newScope, [...ancestors, child]);
                return;
            }

            case "FunctionDeclaration":
            case "FunctionExpression":
            case "ArrowFunctionExpression": {
                visitFunction(node, scope, ancestors);
                return;
            }

            case "StaticBlock": {
                // A static block is a function-like scope; even `var` stays inside
                const blockScope = createScope("function", scope);
                for (const child of node.body) {
                    visit(child, blockScope, [...ancestors, child]);
                }
                return;
            }

            case "SwitchStatement": {
                // All `case` bodies share one block scope.
                visit(node.discriminant, scope, [
                    ...ancestors,
                    node.discriminant,
                ]);
                const caseScope = createScope("block", scope);
                for (const switchCase of node.cases)
                    visit(switchCase, caseScope, [...ancestors, switchCase]);
                return;
            }

            case "VariableDeclaration": {
                for (const decl of node.declarations) {
                    collectPatternIdentifiers(decl.id as acorn.AnyNode, (id) =>
                        bindDeclaredName(scope, id, node.kind),
                    );
                    if (decl.init)
                        visit(decl.init, scope, [...ancestors, decl.init]);
                }
                return;
            }

            case "ForStatement": {
                // The loop head gets its own scope: `let`/`const` bind
                // per-iteration there, while `var` still hoists out to the
                // nearest function scope via `bindIdentifier`.
                const loopScope = createScope("block", scope);
                if (node.init)
                    visit(node.init, loopScope, [...ancestors, node.init]);
                if (node.test)
                    visit(node.test, loopScope, [...ancestors, node.test]);
                if (node.update)
                    visit(node.update, loopScope, [...ancestors, node.update]);
                visit(node.body, loopScope, [...ancestors, node.body]);
                return;
            }

            case "ForOfStatement":
            case "ForInStatement": {
                // Same reasoning as ForStatement: the loop head (`left`) is
                // its own scope. `left` may be a VariableDeclaration (bound
                // here) or an existing reference (e.g. `for (a of b)`).
                const loopScope = createScope("block", scope);
                visit(node.left, loopScope, [...ancestors, node.left]);
                visit(node.right, loopScope, [...ancestors, node.right]);
                visit(node.body, loopScope, [...ancestors, node.body]);
                return;
            }

            case "CatchClause": {
                const catchScope = createScope("block", scope);
                if (node.param) {
                    // The param is a pattern -- `catch ({message})` is legal
                    collectPatternIdentifiers(
                        node.param as acorn.AnyNode,
                        (id) => {
                            bindIdentifier(catchScope, id.name, "param");
                        },
                    );
                    // Default values and computed keys inside the pattern
                    // are ordinary expressions what need resolving
                    visitPatternExpressions(node.param, catchScope, [
                        ...ancestors,
                        node.param,
                    ]);
                }
                visit(node.body, catchScope, [...ancestors, node.body]);
                return;
            }

            case "ClassDeclaration":
            case "ClassExpression": {
                // A class declaration's name binds in the enclosing scope,
                // but a class expression's name is only visible inside its
                // own body
                let bodyScope = scope;
                if (node.id) {
                    if (node.type === "ClassExpression")
                        bodyScope = createScope("block", scope);
                    bindDeclaredName(bodyScope, node.id, "class");
                }
                if (node.superClass)
                    visit(node.superClass, scope, [
                        ...ancestors,
                        node.superClass,
                    ]);
                visit(node.body, bodyScope, [...ancestors, node.body]);
                return;
            }

            case "Identifier": {
                const idNode = node as ScopedIdentifier;
                if (classifyIdentifier(node, ancestors) !== "reference") break;

                // The identifier is a reference...
                // (which we'll resolve once every scope's bindings are done)
                idNode._isAssignment = false;
                references.push({ id: idNode, scope });

                // ...unless it's the LHS of an assignment in an assignment context
                if (isAssignmentContext) {
                    const parent = parentOf(ancestors);
                    if (
                        parent &&
                        parent.type === "AssignmentExpression" &&
                        parent.left === node
                    ) {
                        idNode._isAssignment = true;
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
                        visit(c as acorn.AnyNode, scope, [...ancestors, c]);
                }
            } else if ("type" in child) {
                visit(child as acorn.AnyNode, scope, [...ancestors, child]);
            }
        }
    }

    visit(ast as acorn.AnyNode, globalScope, [ast as acorn.AnyNode]);

    for (const { id, scope } of references) {
        id._scopeType = findBindingScope(scope, id.name)?.type ?? "global";
    }
}

/**
 * Helper type for capturing the variable and all properties in a MemberExpression.
 */
type MemberChain = {
    root: ScopedIdentifier;
    properties: MemberSegment[];
};

/**
 * One property segment of a member chain. `name` is undefined for a computed,
 * non-static segment (`obj[k]`), which has no name to track or highlight.
 */
type MemberSegment = { name: string | undefined; start: number };

/**
 * Does a member chain include any computed, non-static segment?
 *
 * @param chain Chain to inspect.
 * @returns True if any segment has no static name.
 */
function isDynamicChain(chain: MemberChain): boolean {
    return chain.properties.some((p) => p.name === undefined);
}

/**
 * Predicate for names that are globals so aren't story variables.
 */
type IsGlobalName = (name: string) => boolean;

/**
 * Build the global-name predicate for one parse.
 *
 * @param hostGlobals Host globals supplied by the story format, if any.
 * @returns Predicate that's true for JavaScript and host globals.
 */
function globalNamePredicate(hostGlobals?: ReadonlySet<string>): IsGlobalName {
    return (name) => ecmaScriptGlobals.has(name) || !!hostGlobals?.has(name);
}

/**
 * Does a property's scope correspond to a global object?
 *
 * @param scope Scope to inspect.
 * @param isGlobalName: Global-name predicate.
 * @returns True if the scope is rooted in a global object.
 */
function isGlobalObjectScope(
    scope: string,
    isGlobalName: IsGlobalName,
): boolean {
    return isGlobalName(scope.split(".", 1)[0]);
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
        // Don't treat a missing identifier marker as an actual name
        return property.name !== MISSING_IDENTIFIER ? property.name : undefined;
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
 * Determine if a member expression is being assigned to.
 *
 * @param node Member expression being inspected.
 * @param ancestors The node's ancestors.
 * @returns True if the member expression is being assigned to.
 */
function isMemberExpressionAssignment(
    node: acorn.MemberExpression,
    ancestors: acorn.Node[],
): boolean {
    const parent = parentOf(ancestors);
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
    const props: MemberSegment[] = [];
    let current: acorn.Expression | acorn.Super = node;
    let root: ScopedIdentifier | undefined;

    while (true) {
        if (current.type === "MemberExpression") {
            // Capture the property
            const propName = getStaticPropertyName(
                current.property,
                current.computed,
            );
            const start =
                current.computed &&
                current.property.type === "Literal" &&
                typeof current.property.value === "string"
                    ? current.property.start + 1
                    : current.property.start;

            props.unshift({ name: propName, start });
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
    return { root: root, properties: props };
}

/**
 * Recursively capture all properties in an object expression.
 *
 * @param node ObjectExpression node.
 * @param parentScope Parent scope for the object expression.
 * @param isGlobalName: Global-name predicate.
 * @param capturePropertyCallback Callback for capturing a property's token.
 */
function captureObjectExpressionProperties(
    node: acorn.ObjectExpression,
    parentScope: string,
    isGlobalName: IsGlobalName,
    capturePropertyCallback: (
        name: string,
        start: number,
        scope?: string,
        assigned?: boolean,
    ) => void,
) {
    const isGlobalObject = isGlobalObjectScope(parentScope, isGlobalName);

    for (const prop of node.properties) {
        if (prop.type !== "Property") continue; // We only care about properties

        const propName = getStaticPropertyName(
            prop.key,
            prop.computed ?? false,
        );
        if (!propName) continue;

        // Capture the property. Note we blank out the scope for globals so
        // their properties aren't tracked
        capturePropertyCallback(
            propName,
            prop.key.start,
            isGlobalObject ? undefined : parentScope,
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
                isGlobalName,
                capturePropertyCallback,
            );
        }
    }
}

/**
 * Is a node the callee of a call or `new` expression (`foo` in `foo(bar)`,
 * `obj.method` in `obj.method(x)`, `Foo` in `new Foo(bar)`)?
 *
 * @param node The node to test.
 * @param parent The node's immediate parent node, if any.
 * @returns True if the node is a call or `new` callee.
 */
function isCallee(
    node: acorn.AnyNode,
    parent: acorn.AnyNode | undefined,
): boolean {
    return (
        (parent?.type === "NewExpression" ||
            parent?.type === "CallExpression") &&
        parent.callee === node
    );
}

/**
 * Is an identifier a function declaration's or function expression's own
 * name or parameter?
 *
 * @param role The identifier's classified role.
 * @param parent The identifier's immediate parent, if any.
 * @returns True if the identifier is a function's own name or parameter.
 */
function isFunctionOwnBinding(
    role: IdentifierRole,
    parent: acorn.AnyNode | undefined,
): boolean {
    return (
        role === "declaration" &&
        (parent?.type === "FunctionDeclaration" ||
            parent?.type === "FunctionExpression")
    );
}

/**
 * Is an identifier excluded from highlighting and extraction because of its
 * immediate parent: a call/`new` callee, a shorthand property's value, or a
 * function's own name or parameter?
 *
 * @param role The identifier's classified role.
 * @param parent The identifier's immediate parent node, if any.
 * @param node The identifier itself.
 * @returns True if the identifier should be excluded from both highlighting and extraction.
 */
function isExcludedIdentifier(
    role: IdentifierRole,
    parent: acorn.AnyNode | undefined,
    node: acorn.AnyNode,
): boolean {
    if (isCallee(node, parent)) return true;
    if (parent?.type === "Property" && parent.shorthand) return true;
    return isFunctionOwnBinding(role, parent);
}

/**
 * Is the name potentially a variable we want to track?
 *
 * We don't track empty names, missing identifiers from loose
 * parsing, or globals.
 *
 * @param name Identifier name.
 * @param isGlobalName Global-name predicate.
 * @returns True if the name could be a variable to be tracked.
 */
function isPotentialTrackedVariableName(
    name: string,
    isGlobalName: IsGlobalName,
): boolean {
    return !!name && name !== MISSING_IDENTIFIER && !isGlobalName(name);
}

/**
 * Is an identifier a candidate variable occurrence -- that is, one that
 * highlighting marks as a variable and extraction considers (subject to scope)
 * as a story variable?
 *
 * @param node Identifier to test.
 * @param ancestors Node's ancestors, ending with `node` itself.
 * @param isGlobalName Global-name predicate.
 * @returns True if the identifier is a candidate variable occurrence.
 */
function isCandidateVariable(
    node: acorn.Identifier,
    ancestors: acorn.Node[],
    isGlobalName: IsGlobalName,
): boolean {
    const role = classifyIdentifier(node, ancestors);
    if (role === "neither") return false;
    if (isExcludedIdentifier(role, parentOf(ancestors), node)) return false;
    return isPotentialTrackedVariableName(node.name, isGlobalName);
}

/**
 * A semantic token before it's been reported to the story format parsing state
 */
interface PreSemanticToken {
    text: string; // Actual token text
    at: number; // Token location
    type: TokenType; // Type of the token
    modifiers: TokenModifier[]; // Modifiers for the token
}

/**
 * Compute semantic tokens for a parsed JavaScript program or expression.
 *
 * This pass only cares about what a token looks like (its text, position,
 * and type) and never consults scope, so it doesn't need `annotateVariableScopes`
 * to have run first.
 *
 * @param text Original unparsed text.
 * @param ast Parsed text.
 * @param isGlobalName Global-name predicate.
 * @returns Object whose keys are the token's location in the unparsed text and whose values are semantic tokens.
 */
function computeSemanticTokens(
    text: string,
    ast: acorn.Node,
    isGlobalName: IsGlobalName,
): Record<number, PreSemanticToken> {
    const tokens: Record<number, PreSemanticToken> = {};

    // We end up setting semantic tokens for some nodes multiple times (for
    // example, an Identifier and then again for a property that's an identifier).
    // We don't worry about that, though, because the walker visits the bottom-most
    // node first, then moves up to the containing expression or property, and the
    // last-set semantic token is the one that's reported.
    const addToken = (start: number, tokenText: string, type: TokenType) => {
        tokens[start] = { text: tokenText, at: start, type, modifiers: [] };
    };

    // Helper function to add a variable token if it's not a built-in JS object
    const captureVariable = (id: ScopedIdentifier) => {
        if (!isPotentialTrackedVariableName(id.name, isGlobalName)) return;
        addToken(id.start, id.name, ETokenType.variable);
    };

    // Helper function to add a property token if it's not dynamic
    const captureProperty = (name: string | undefined, start: number) => {
        // An `undefined` name indicates a dynamic property
        if (!name) return;
        addToken(start, name, ETokenType.property);
    };

    acornWalk.fullAncestor(ast, (rawNode, _, ancestors) => {
        const node = rawNode as acorn.AnyNode;
        switch (node.type) {
            case "Identifier": {
                if (isCandidateVariable(node, ancestors, isGlobalName)) {
                    captureVariable(node as ScopedIdentifier);
                }
                break;
            }

            case "Literal": {
                if (node.raw !== undefined) {
                    const semanticType = typeofToSemantic[typeof node.value];
                    if (semanticType !== undefined) {
                        addToken(node.start, node.raw, semanticType);
                    }
                }
                break;
            }

            case "AssignmentExpression":
            case "BinaryExpression":
            case "LogicalExpression": {
                const at = text.indexOf(node.operator, node.left.end);
                addToken(at, node.operator, ETokenType.operator);
                break;
            }

            case "CallExpression":
            case "NewExpression": {
                if (node.callee.type === "Identifier") {
                    addToken(
                        node.callee.start,
                        node.callee.name,
                        ETokenType.function,
                    );
                } else if (node.callee.type === "MemberExpression") {
                    const chain = captureMemberChain(node.callee);
                    const lastProp = chain?.properties.at(-1);
                    // A non-static callee (`obj[k](x)`) has no name to mark
                    // as a function; `k` keeps its own variable token.
                    if (lastProp && lastProp.name !== undefined) {
                        addToken(
                            lastProp.start,
                            lastProp.name,
                            ETokenType.function,
                        );
                    }
                }
                break;
            }

            case "UnaryExpression":
            case "UpdateExpression": {
                const at = node.prefix
                    ? node.start
                    : node.end - node.operator.length;
                addToken(at, node.operator, ETokenType.operator);
                break;
            }

            case "MemberExpression": {
                const chain = captureMemberChain(node);
                if (!chain) break;

                // Highlighting doesn't care about scope, so (unlike extraction)
                // we don't bail out for a locally-bound root here.
                captureVariable(chain.root);
                for (const prop of chain.properties) {
                    captureProperty(prop.name, prop.start);
                }
                break;
            }

            case "Property": {
                const propName = getStaticPropertyName(
                    node.key,
                    node.computed ?? false,
                );
                if (!propName) break;

                // Unlike extraction, highlighting doesn't need to walk up the
                // ancestors to find a scope prefix: every property key gets its
                // own token regardless of nesting.
                captureProperty(propName, node.key.start);
                break;
            }

            case "VariableDeclaration": {
                addToken(node.start, node.kind, ETokenType.keyword);
                break;
            }
        }
    });

    return tokens;
}

/**
 * A variable occurrence found while extracting symbols, before it's turned into a `JSVariableLabel`.
 */
interface RawVariableOccurrence {
    text: string;
    at: number;
    assigned: boolean;
}

/**
 * A property occurrence found while extracting symbols, before it's turned into a `JSPropertyLabel`.
 */
interface RawPropertyOccurrence {
    text: string;
    at: number;
    scope?: string;
    assigned: boolean;
}

/**
 * Extract story-variable and story-property occurrences from a parsed JavaScript
 * program or expression.
 *
 * This pass consults scope (as annotated by `annotateVariableScopes`, which must
 * have already run) to resolve names and never cares about operators, literals,
 * or keywords.
 *
 * @param ast Parsed text, already annotated by `annotateVariableScopes`.
 * @param isGlobalName Global-name predicate.
 * @returns Variable and property occurrences, in ascending order of position.
 */
function extractSymbols(
    ast: acorn.Node,
    isGlobalName: IsGlobalName,
): {
    variables: RawVariableOccurrence[];
    properties: RawPropertyOccurrence[];
} {
    // Keyed by position so that, when converted to an array below, occurrences
    // come out in ascending source position order
    const variableTokens: Record<number, RawVariableOccurrence> = {};
    const propertyTokens: Record<number, RawPropertyOccurrence> = {};

    // Helper function to add a variable occurrence if it's an unbound (story)
    // variable and not a global
    const captureVariable = (id: ScopedIdentifier) => {
        if (!isPotentialTrackedVariableName(id.name, isGlobalName)) return;
        if (id._scopeType !== "global") return;
        variableTokens[id.start] = {
            text: id.name,
            at: id.start,
            assigned: !!id._isAssignment,
        };
    };

    // Helper function to add a property occurrence if it's not dynamic and has a known scope
    const captureProperty = (
        name: string | undefined,
        start: number,
        scope?: string,
        assigned = false,
    ) => {
        if (!name) return;
        // Properties w/o a scope (e.g. globals) aren't tracked
        if (scope === undefined) return;
        propertyTokens[start] = {
            text: name,
            at: start,
            scope,
            assigned,
        };
    };

    acornWalk.fullAncestor(ast, (rawNode, _, ancestors) => {
        const node = rawNode as acorn.AnyNode;
        switch (node.type) {
            case "Identifier": {
                if (isCandidateVariable(node, ancestors, isGlobalName)) {
                    captureVariable(node as ScopedIdentifier);
                }
                break;
            }

            case "MemberExpression": {
                const chain = captureMemberChain(node);
                if (!chain) break;

                // If the root is locally bound (not a story variable), bail out
                if (chain.root._scopeType !== "global") {
                    break;
                }

                const assigned = isMemberExpressionAssignment(node, ancestors);
                const isGlobal = isGlobalName(chain.root.name);

                // Add the root variable
                captureVariable(chain.root);

                // Track dynamic properties incrementally
                let dynamicEncountered = false;

                chain.properties.forEach((prop, i) => {
                    if (prop.name === undefined) {
                        dynamicEncountered = true;
                        return; // Skip capturing dynamic property itself
                    }
                    if (
                        isCallee(node, parentOf(ancestors)) &&
                        i === chain.properties.length - 1
                    ) {
                        return; // Skip the callee's own name
                    }

                    // Scope is valid only until the first dynamic property
                    const scope =
                        !dynamicEncountered && !isGlobal
                            ? [
                                  chain.root.name,
                                  ...chain.properties
                                      .slice(0, i)
                                      .map((p) => p.name),
                              ].join(".")
                            : undefined;

                    // Only count the property as assigned if its root is a story variable
                    captureProperty(
                        prop.name,
                        prop.start,
                        scope,
                        assigned && chain.root._scopeType === "global",
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
                                (left as ScopedIdentifier)._scopeType ===
                                "global"
                            ) {
                                parentScope = left.name;
                                captureObjectExpressionProperties(
                                    ancestor.right,
                                    parentScope,
                                    isGlobalName,
                                    captureProperty,
                                );
                            }
                            break;
                        } else if (left.type === "MemberExpression") {
                            const chain = captureMemberChain(left);
                            if (
                                chain &&
                                !isDynamicChain(chain) &&
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
                                    isGlobalName,
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
                                isGlobalName,
                                captureProperty,
                            );
                        }
                        break;
                    }
                }

                // Capture the property. Note we blank out the scope for built-in
                // objects so they don't get tracked as occurrences.
                captureProperty(
                    propName,
                    node.key.start,
                    isGlobalObjectScope(parentScope || "", isGlobalName)
                        ? undefined
                        : parentScope || undefined,
                    true,
                );
                break;
            }
        }
    });

    return {
        variables: Object.values(variableTokens),
        properties: Object.values(propertyTokens),
    };
}

/**
 * Check whether every identifier that is a potential tracked variable for
 * story formats is a variable based on a caller-supplied predicate.
 *
 * Unlike `isCandidateVariable`, this doesn't follow extraction's temporary
 * exclusions: a shorthand property's value (`a` in `{a}`) is a read, so it's
 * checked. It's for callers like `isTwineScriptExpression` that only need a
 * yes/no answer about the identifiers themselves, not their scope.
 *
 * @param ast Parsed AST to walk.
 * @param isVariable Predicate that determines variable-ness for the story
 * format.
 * @param hostGlobals Additional host globals (e.g. browser or JQuery library
 * globals) that should be ignored.
 * @returns True if every candidate identifier satisfies the predicate.
 */
export function isEveryIdentifierAVariable(
    ast: acorn.Node,
    isVariable: (name: string, start: number) => boolean,
    hostGlobals?: ReadonlySet<string>,
): boolean {
    let allValid = true;
    const isGlobalName = globalNamePredicate(hostGlobals);

    acornWalk.fullAncestor(ast, (rawNode, _, ancestors) => {
        // Once allValid is false, we don't need to look any further
        if (!allValid) return;

        const node = rawNode as acorn.AnyNode;
        // Only check identifiers
        if (node.type !== "Identifier") return;
        const role = classifyIdentifier(node, ancestors);
        if (role === "neither") return;
        const parent = parentOf(ancestors);
        if (isCallee(node, parent) || isFunctionOwnBinding(role, parent))
            return;
        if (!isPotentialTrackedVariableName(node.name, isGlobalName)) return;

        if (!isVariable(node.name, node.start)) allValid = false;
    });

    return allValid;
}

/**
 * Parse text as a JavaScript program or expression.
 *
 * This performs strict parsing, and throws an augmented SyntaxError if
 * the program doesn't parse correctly.
 *
 * A program has to have full statements. An expression can be just a snippet.
 *
 * @param text Text to parse as JavaScript.
 * @param isProgram Whether the text is a full program or just an expression.
 * @returns Top-most node in the AST.
 */
export function parseJSStrict(text: string, isProgram: boolean): acorn.Node {
    // n.b. we're using ParserWithState so's we get actual useful information
    // out of any thrown SyntaxError.
    if (isProgram) {
        return ParserWithState.parse(text, {
            ecmaVersion: EcmaVersion,
            sourceType: "script",
        });
    } else {
        return ParserWithState.parseExpressionAt(text, 0, {
            ecmaVersion: EcmaVersion,
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
 * @param offset Offset into the containing document where the text occurs.
 * @returns Top-most node in the AST, or undefined if the parsing failed.
 */
export function parseJS(
    text: string,
    isProgram: boolean,
    offset = 0,
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
                    raisedAt?: number;
                },
                offset,
            ),
            severity: DiagnosticSeverity.Error,
        };
    }

    // Finally try whatever parsing we can get away with
    return [
        acornLoose.parse(text, {
            ecmaVersion: EcmaVersion,
        }),
        diagnostic,
    ];
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
 * @param storyFormatState Story format parsing state that supplies the format's host globals
 * and collects semantic tokens.
 * @param isAssignmentContext True if the code's purpose is to set state (an assignment context),
 * so write-shaped syntax beyond declarations counts as an assignment. Otherwise they're reported
 * as reads since, they're often a `==` typo or a side effect.
 * @returns Tokenized variables and properties and any parsing error.
 */
export function tokenizeJavaScript(
    isProgram: boolean,
    text: string,
    offset: number,
    document: TextDocument,
    storyFormatState: StoryFormatParsingState,
    isAssignmentContext?: boolean,
): TokenizedJS {
    const tokenized: TokenizedJS = {
        variables: [],
        properties: [],
    };

    const [ast, diagnostic] = parseJS(text, isProgram, offset);
    tokenized.error = diagnostic;
    if (ast !== undefined) {
        annotateVariableScopes(ast, !!isAssignmentContext);
        const isGlobalName = globalNamePredicate(storyFormatState.hostGlobals);

        // Collect all semantic tokens (which ignores token scope)
        const semanticTokens = computeSemanticTokens(text, ast, isGlobalName);
        for (const token of Object.values(semanticTokens)) {
            capturePreSemanticTokenFor(
                token.text,
                offset + token.at,
                token.type,
                token.modifiers,
                storyFormatState,
            );
        }

        // Collect all scope-resolved variables and properties we care about
        const { variables, properties } = extractSymbols(ast, isGlobalName);
        for (const variable of variables) {
            tokenized.variables.push({
                contents: variable.text,
                location: createLocationFor(
                    variable.text,
                    offset + variable.at,
                    document,
                ),
                assigned: variable.assigned,
            });
        }
        for (const property of properties) {
            tokenized.properties.push({
                contents: property.text,
                location: createLocationFor(
                    property.text,
                    offset + property.at,
                    document,
                ),
                prefix: property.scope,
                assigned: property.assigned,
            });
        }
    }

    return tokenized;
}
