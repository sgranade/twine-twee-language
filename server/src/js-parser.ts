import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import * as eslintScope from "eslint-scope";
import type * as ESTree from "estree";
import { DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { improveAcornErrorMessage } from "./acorn-errors";
import { ParserWithState } from "./acorn-errors/parser-state";
import { ParseEcmaVersion, ScopeEcmaVersion } from "./ecma-version";
import { createLocationFor } from "./parser";
import {
    StoryFormatParsingState,
    capturePreSemanticTokenFor,
} from "./passage-text-parsers/types";
import { Callable, calleeFlag, Sigiled } from "./project-index";
import { ETokenType, TokenModifier, TokenType } from "./semantic-tokens";
import { Label } from "./types";

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
export interface JSVariableLabel extends Label, Sigiled {
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
    /**
     * Whether the property is the callee of a call or `new` (e.g. `push` in `arr.push(x)`)
     */
    isCallee?: boolean;
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

// This is hacky, but we're going to ignore properties at any depth whose last
// segment matches a property of built-in objects' instances. Names an author
// is likely to choose (`name`, `message`, `size`, ...) are deliberately absent.
// Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects
const builtInJSObjectInstanceProperties = new Set([
    "prototype", // Object
    "arguments", // Function
    "caller", // Function
    "length", // Function, String, Array
    "dotAll", // RegExp
    "hasIndices", // RegExp
    "ignoreCase", // RegExp
    "multiline", // RegExp
    "sticky", // RegExp
    "unicode", // RegExp
    "unicodeSets", // RegExp
    "lastIndex", // RegExp
    "byteLength", // ArrayBuffer, SharedArrayBuffer, DataView
    "detached", // ArrayBuffer
    "maxByteLength", // ArrayBuffer, SharedArrayBuffer
    "resizable", // ArrayBuffer
    "growable", // SharedArrayBuffer
    "byteOffset", // DataView
    "disposed", // DisposableStack, AsyncDisposableStack
    "constructor", // Object
]);

// Built-in method names. These are only exempt when the property is called
// (`$arr.push(x)`), so a plain read like `$player.keys` still warns.
const builtInJSMethodNames = new Set([
    "push",
    "pop",
    "shift",
    "unshift",
    "slice",
    "splice",
    "concat",
    "join",
    "indexOf",
    "lastIndexOf",
    "includes",
    "find",
    "findIndex",
    "filter",
    "map",
    "reduce",
    "forEach",
    "some",
    "every",
    "sort",
    "reverse",
    "flat",
    "trim",
    "toUpperCase",
    "toLowerCase",
    "replace",
    "split",
    "startsWith",
    "endsWith",
    "padStart",
    "padEnd",
    "repeat",
    "charAt",
    "toString",
    "valueOf",
    "hasOwnProperty",
    "get",
    "set",
    "has",
    "add",
    "delete",
    "clear",
    "keys",
    "values",
    "entries",
    "then",
    "catch",
    "finally",
]);

/**
 * Add scope information to an Acorn identifier.
 */
interface ScopedIdentifier extends acorn.Identifier {
    _isAssignment?: boolean;
    _isStoryVariable?: boolean;
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
 * Is a reference a write, given the caller's assignment context?
 *
 * A declaration's initializer always writes. Any other write-shaped
 * syntax (`a = 1`, `a++`, `[a] = b`, `for (a of b)`) is a write only
 * in an assignment context, since elsewhere it's more often a `==`
 * typo or side effect
 *
 * @param ref eslint-scope reference to the identifier.
 * @param isAssignmentContext True if write-shaped syntax counts as an assignment
 * @returns True if the reference is a write.
 */
function isWriteReference(
    ref: eslintScope.Reference,
    isAssignmentContext: boolean,
): boolean {
    return ref.init === true || (isAssignmentContext && ref.isWrite());
}

/**
 * Is a member expression in a write position, given the caller's assignment
 * context?
 *
 * This is `isWriteReference` for nodes eslint-scope has no `Reference`
 * for.
 *
 * @param node Member expression being inspected.
 * @param ancestors The node's ancestors, ending with `node` itself.
 * @param isAssignmentContext True if write-shaped syntax counts as an assignment.
 * @returns True if the member expression is in a write position.
 */
function isWriteTarget(
    node: acorn.MemberExpression,
    ancestors: acorn.Node[],
    isAssignmentContext: boolean,
): boolean {
    if (!isAssignmentContext) return false;
    const parent = parentOf(ancestors);
    switch (parent?.type) {
        case "AssignmentExpression":
        case "AssignmentPattern":
            return parent.left === node;
        case "UpdateExpression":
            return parent.argument === node;
        case "ForInStatement":
        case "ForOfStatement":
            return parent.left === node;
        case "ArrayPattern":
        case "RestElement":
            return true;
        case "ObjectPattern":
            // acorn-walk skips the `Property` or `RestElement` between the
            // pattern and its value, so find which property (if any) holds
            // this node.
            return parent.properties.some((prop) =>
                prop.type === "Property"
                    ? prop.value === node
                    : prop.argument === node,
            );
        default:
            return false;
    }
}

/**
 * Does the top level of a program use `import` or `export`?
 */
function hasModuleSyntax(program: ESTree.Program): boolean {
    return program.body.some((node) => /^(Import|Export)/.test(node.type));
}

/**
 * Get a `Program` for eslint-scope to analyze.
 *
 * An expression parse has no `Program` root, so it's wrapped in one.
 */
function toProgram(ast: acorn.Node): ESTree.Program {
    if (ast.type === "Program") return ast as unknown as ESTree.Program;
    const range: [number, number] = [ast.start, ast.end];
    return {
        type: "Program",
        sourceType: "script",
        start: ast.start,
        end: ast.end,
        range,
        body: [
            {
                type: "ExpressionStatement",
                start: ast.start,
                end: ast.end,
                range,
                expression: ast,
            },
        ],
    } as unknown as ESTree.Program;
}

/**
 * Find the outer variable that a class declaration's inner self-binding stands for.
 */
function findOuterClassVariable(
    inner: eslintScope.Variable,
): eslintScope.Variable | null {
    for (
        let scope: eslintScope.Scope | null = inner.scope.upper;
        scope;
        scope = scope.upper
    ) {
        const outer = scope.set.get(inner.name);
        if (outer) return outer;
    }
    return null;
}

/**
 * Annotate variable definitions or references along with their scope.
 *
 * A reference counts as being in the "global" scope (i.e. a story variable)
 * if nothing resolves it or it resolves to a root-level declaration
 * (global or module scope).
 *
 * @param ast AST to annotate.
 * @param isAssignmentContext True if write-shaped syntax counts as an assignment.
 */
function annotateVariableScopes(ast: acorn.Node, isAssignmentContext: boolean) {
    const program = toProgram(ast);
    const scopeManager = eslintScope.analyze(program, {
        ecmaVersion: ScopeEcmaVersion,
        sourceType: hasModuleSyntax(program) ? "module" : "script",
        optimistic: true,
    });
    const isRootScope = (scope: eslintScope.Scope): boolean =>
        scope.type === "global" || scope.type === "module";

    for (const scope of scopeManager.scopes) {
        for (const ref of scope.references) {
            const id = ref.identifier as unknown as ScopedIdentifier;
            id._isAssignment = isWriteReference(ref, isAssignmentContext);

            let variable = ref.resolved;
            // A class's name inside its own body resolves to an inner
            // binding. Redirect to the outer variable the class declares.
            if (variable?.scope.type === "class") {
                const def = variable.defs[0];
                variable =
                    def?.node.type === "ClassDeclaration"
                        ? findOuterClassVariable(variable)
                        : variable;
            }
            id._isStoryVariable = !variable || isRootScope(variable.scope);
        }
    }
    // Root-level declarations are assignments, whether or not they have an
    // initializer (and so a write reference).
    const rootScopes = scopeManager.scopes.filter(isRootScope);
    for (const scope of rootScopes) {
        for (const variable of scope.variables) {
            for (const def of variable.defs) {
                if (
                    def.type === "Variable" ||
                    def.type === "FunctionName" ||
                    def.type === "ClassName"
                ) {
                    const id = def.name as unknown as ScopedIdentifier;
                    id._isAssignment = true;
                    id._isStoryVariable = true;
                }
            }
        }
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
 * Does a property reference correspond to a built-in JS object's instance property?
 *
 * The property name is the last segment of its full path (`prop2` in
 * `var.prop1.prop2`). Instance properties are exempt anywhere; method names
 * are exempt only when the property is called.
 *
 * @param property Property to reference inspect, w/its full path in `contents`.
 * @returns True if the property matches a built-in property or called built-in method.
 */
export function isBuiltinJSProperty(
    property: Pick<Label, "contents"> & Callable,
): boolean {
    const name = property.contents.split(".").pop() || "";
    return (
        builtInJSObjectInstanceProperties.has(name) ||
        (!!property.isCallee && builtInJSMethodNames.has(name))
    );
}

/**
 * A JavaScript identifier name. Reserved words count: `obj.class` is valid.
 */
const identifierNameRegexp =
    /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;

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

    // A string literal key (`obj['k']`, `{'k': 1}`) has a static name only if it's
    // written as a plain identifier name, so the property's path can be spelled
    // with dots and its label range matches the source text. Numeric keys and
    // other strings (`'a.b'`, `'my key'`, `'1'`, `'\u0061'`) are treated as
    // dynamic.
    if (
        property.type === "Literal" &&
        typeof property.value === "string" &&
        identifierNameRegexp.test(property.value) &&
        property.raw?.slice(1, -1) === property.value
    ) {
        return property.value;
    }

    return undefined;
}

/**
 * Get the start of a property key's name, skipping the opening quote of a string literal.
 *
 * @param key The property's key node.
 * @returns Start of the name in the text.
 */
function getPropertyNameStart(key: acorn.AnyNode): number {
    return key.type === "Literal" && typeof key.value === "string"
        ? key.start + 1
        : key.start;
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
            const start = getPropertyNameStart(current.property);

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
 * @param assigned Whether the literal's keys count as written.
 * @param capturePropertyCallback Callback for capturing a property's token.
 */
function captureObjectExpressionProperties(
    node: acorn.ObjectExpression,
    parentScope: string,
    isGlobalName: IsGlobalName,
    assigned: boolean,
    capturePropertyCallback: (
        name: string,
        start: number,
        scope?: string,
        assigned?: boolean,
        isCallee?: boolean,
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
            getPropertyNameStart(prop.key),
            isGlobalObject ? undefined : parentScope,
            assigned,
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
                assigned,
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
 * Is an identifier excluded from highlighting and extraction because it's a
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
    // A top-level function declaration's name is a write, so don't exclude it
    if (
        parent?.type === "FunctionDeclaration" &&
        parent.id === node &&
        role === "declaration"
    )
        return false;
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
                captureProperty(propName, getPropertyNameStart(node.key));
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
    isCallee: boolean;
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
 * @param isAssignmentContext True if write-shaped syntax counts as an assignment.
 * @returns Variable and property occurrences, in ascending order of position.
 */
function extractSymbols(
    ast: acorn.Node,
    isGlobalName: IsGlobalName,
    isAssignmentContext: boolean,
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
        if (!id._isStoryVariable) return;
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
        isCallee = false,
    ) => {
        if (!name) return;
        // Properties w/o a scope (e.g. globals) aren't tracked
        if (scope === undefined) return;
        propertyTokens[start] = {
            text: name,
            at: start,
            scope,
            assigned,
            isCallee,
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
                if (!chain.root._isStoryVariable) {
                    break;
                }

                const written = isWriteTarget(
                    node,
                    ancestors,
                    isAssignmentContext,
                );
                const isGlobal = isGlobalName(chain.root.name);

                // Add the root variable
                captureVariable(chain.root);

                // If this member expression is iteslf a call or a `new` callee
                // (e.g. `obj.method` in `obj.method(x)`), its last segment is
                // a method-call property
                const lastIsCallee = isCallee(node, parentOf(ancestors));

                // Track dynamic properties incrementally
                let dynamicEncountered = false;

                chain.properties.forEach((prop, i) => {
                    if (prop.name === undefined) {
                        dynamicEncountered = true;
                        return; // Skip capturing dynamic property itself
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

                    // Only the final segment is written or called; the rest are reads
                    const isFinalSegment = i === chain.properties.length - 1;
                    captureProperty(
                        prop.name,
                        prop.start,
                        scope,
                        written && isFinalSegment,
                        lastIsCallee && isFinalSegment,
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
                // A declaration's keys are always written; a bare assignment's follow the flag
                let keysAssigned = isAssignmentContext;

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
                            if ((left as ScopedIdentifier)._isStoryVariable) {
                                parentScope = left.name;
                                captureObjectExpressionProperties(
                                    ancestor.right,
                                    parentScope,
                                    isGlobalName,
                                    isAssignmentContext,
                                    captureProperty,
                                );
                            }
                            break;
                        } else if (left.type === "MemberExpression") {
                            const chain = captureMemberChain(left);
                            if (
                                chain &&
                                !isDynamicChain(chain) &&
                                chain.root._isStoryVariable
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
                                    isAssignmentContext,
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

                        if (id._isStoryVariable) {
                            parentScope = id.name;
                            captureObjectExpressionProperties(
                                ancestor.init,
                                parentScope,
                                isGlobalName,
                                true,
                                captureProperty,
                            );
                            keysAssigned = true;
                        }
                        break;
                    }
                }

                // Capture the property. Note we blank out the scope for built-in
                // objects so they don't get tracked as occurrences
                captureProperty(
                    propName,
                    getPropertyNameStart(node.key),
                    isGlobalObjectScope(parentScope || "", isGlobalName)
                        ? undefined
                        : parentScope || undefined,
                    keysAssigned,
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
 * Unlike `isCandidateVariable`, this skips callees.
 *
 * This function is for callers like `isTwineScriptExpression` that only need a
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
            ecmaVersion: ParseEcmaVersion,
            sourceType: "script",
            ranges: true,
        });
    } else {
        return ParserWithState.parseExpressionAt(text, 0, {
            ecmaVersion: ParseEcmaVersion,
            sourceType: "script",
            ranges: true,
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
            ecmaVersion: ParseEcmaVersion,
            ranges: true,
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
 * @param options Tokenizing options.
 * @param options.isAssignmentContext True if the code's purpose is to set state (an assignment context),
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
    { isAssignmentContext = false }: { isAssignmentContext?: boolean } = {},
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
        const { variables, properties } = extractSymbols(
            ast,
            isGlobalName,
            isAssignmentContext,
        );
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
                ...calleeFlag(property),
            });
        }
    }

    return tokenized;
}
