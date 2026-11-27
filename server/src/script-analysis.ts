import * as acorn from "acorn";
import type * as eslintScope from "eslint-scope";

// `acorn-loose`'s marker for a missing identifier
export const MISSING_IDENTIFIER = "✖";

const identifierNameRegexp =
    /^[\p{ID_Start}$_][\p{ID_Continue}$\u200C\u200D]*$/u;

/**
 * Is the text a valid unescaped JavaScript IdentifierName?
 */
export function isIdentifierName(text: string): boolean {
    return identifierNameRegexp.test(text);
}

/**
 * Reserved words that can't be a JavaScript binding or bare reference,
 * including the ones reserved only in strict mode or in modules.
 */
const reservedWords: ReadonlySet<string> = new Set([
    "await",
    "break",
    "case",
    "catch",
    "class",
    "const",
    "continue",
    "debugger",
    "default",
    "delete",
    "do",
    "else",
    "enum",
    "export",
    "extends",
    "false",
    "finally",
    "for",
    "function",
    "if",
    "implements",
    "import",
    "in",
    "instanceof",
    "interface",
    "let",
    "new",
    "null",
    "package",
    "private",
    "protected",
    "public",
    "return",
    "static",
    "super",
    "switch",
    "this",
    "throw",
    "true",
    "try",
    "typeof",
    "var",
    "void",
    "while",
    "with",
    "yield",
]);

/**
 * Is `text` a JavaScript reserved word and so can't be a bare name?
 */
export function isReservedWord(text: string): boolean {
    return reservedWords.has(text);
}

/**
 * A statically-known name and where it sits in the source.
 */
export interface StaticName {
    name: string;
    start: number;
}

/**
 * Scope-aware script analyzing helpers.
 */
export interface ScriptAnalysis {
    /**
     * Is the identifier a reference that's not otherwise been bound by analyzed code?
     */
    isUnbound(id: acorn.Node): boolean;
    /**
     * Get the statically-known name of a property key or computed member if
     * its source spelling is the plain name. Escaped spellings (`'\x66oo'`)
     * return undefined.
     */
    staticKeyName(key: acorn.Node, computed: boolean): StaticName | undefined;
    /**
     * Get the statically-known name of a member expression's property.
     */
    memberName(node: acorn.MemberExpression): StaticName | undefined;
    /**
     * Resolve an identifier that's a never-reassigned `var`/`let`/`const`
     * whose single initializer is a root, as judged by `rootOf`.
     *
     * @param id Identifier to resolve.
     * @param rootOf Returns the root value for an initializer expression, if it is one.
     */
    aliasRoot<T>(
        id: acorn.Identifier,
        rootOf: (node: acorn.Node) => T | undefined,
    ): T | undefined;
    /**
     * Split a call to the global `Object.assign` into its target and sources.
     *
     * @param node Call to inspect.
     * @returns The call's target and sources, or undefined if it isn't a call
     * to the global `Object.assign` with a target.
     */
    objectAssignCall(
        node: acorn.CallExpression,
    ): { target: acorn.AnyNode; sources: acorn.AnyNode[] } | undefined;
}

/**
 * Create scope-aware helpers for one parsed snippet.
 *
 * @param text The snippet's source text.
 * @param scopeManager eslint-scope analysis of the snippet.
 */
export function createScriptAnalysis(
    text: string,
    scopeManager: eslintScope.ScopeManager,
): ScriptAnalysis {
    const references = new Map<acorn.Node, eslintScope.Reference>();
    for (const scope of scopeManager.scopes) {
        for (const ref of scope.references) {
            references.set(ref.identifier as unknown as acorn.Node, ref);
        }
    }
    // One cache per `rootOf` to separate different root judgements
    const aliasCaches = new Map<
        (node: acorn.Node) => unknown,
        Map<eslintScope.Variable, unknown>
    >();

    const isPlainStringSource = (node: acorn.Node, value: string): boolean =>
        text.slice(node.start + 1, node.end - 1) === value;

    const isUnbound = (id: acorn.Node): boolean => {
        const ref = references.get(id);
        return !!ref && !ref.resolved;
    };

    const staticKeyName = (
        key: acorn.Node,
        computed: boolean,
    ): StaticName | undefined => {
        if (!computed && key.type === "Identifier") {
            const name = (key as acorn.Identifier).name;
            return text.slice(key.start, key.end) === name
                ? { name, start: key.start }
                : undefined;
        }
        if (key.type === "Literal") {
            const value = (key as acorn.Literal).value;
            if (typeof value === "string" && isPlainStringSource(key, value)) {
                return { name: value, start: key.start + 1 };
            }
        }
        if (
            key.type === "TemplateLiteral" &&
            (key as acorn.TemplateLiteral).expressions.length === 0
        ) {
            const value = (key as acorn.TemplateLiteral).quasis[0].value.cooked;
            if (value != null && isPlainStringSource(key, value)) {
                return { name: value, start: key.start + 1 };
            }
        }
        return undefined;
    };

    const memberName = (node: acorn.MemberExpression) =>
        staticKeyName(node.property, node.computed);

    return {
        isUnbound,
        staticKeyName,
        memberName,
        objectAssignCall(node) {
            const callee = node.callee;
            if (
                callee.type !== "MemberExpression" ||
                memberName(callee)?.name !== "assign" ||
                callee.object.type !== "Identifier" ||
                callee.object.name !== "Object" ||
                !isUnbound(callee.object) ||
                node.arguments.length === 0
            )
                return undefined;
            const [target, ...sources] = node.arguments as acorn.AnyNode[];
            return { target, sources };
        },
        aliasRoot<T>(
            id: acorn.Identifier,
            rootOf: (node: acorn.Node) => T | undefined,
        ): T | undefined {
            const variable = references.get(id)?.resolved;
            if (!variable) return undefined;
            let aliasCache = aliasCaches.get(rootOf);
            if (!aliasCache) {
                aliasCache = new Map();
                aliasCaches.set(rootOf, aliasCache);
            }
            if (aliasCache.has(variable)) return aliasCache.get(variable) as T;
            // Guard against self-referential initializers
            aliasCache.set(variable, undefined);

            let root: T | undefined;
            const writes = variable.references.filter((r) => r.isWrite());
            if (
                variable.defs.length === 1 &&
                variable.defs[0].type === "Variable" &&
                writes.length === 1 &&
                writes[0].init === true
            ) {
                const declarator = variable.defs[0].node as unknown as {
                    id: acorn.Node;
                    init?: acorn.Node | null;
                };
                if (declarator.id.type === "Identifier" && declarator.init) {
                    root = rootOf(declarator.init);
                }
            }
            aliasCache.set(variable, root);
            return root;
        },
    };
}
