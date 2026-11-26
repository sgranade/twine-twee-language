import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";

import {
    argumentShape,
    isEcmaScriptGlobal,
    ScriptPropertyOccurrence,
    ScriptSymbolExtractor,
    ScriptVariableOccurrence,
} from "../../js-parser";
import { shapeFlags } from "../../project-index";
import { browserGlobals } from "../host-globals";
import {
    createScriptAnalysis,
    isIdentifierName,
    MISSING_IDENTIFIER,
    StaticName,
} from "../../script-analysis";

/**
 * Chapbook names that are never story variables, even when unbound.
 */
const excludedNames: ReadonlySet<string> = new Set(["engine", "go", "restart"]);

/**
 * Chapbook names that are always story variables when unbound (i.e. never
 * a conditional reference).
 */
const storyVariableNames: ReadonlySet<string> = new Set(["config"]);

/**
 * Explanation of what a bare name in Chapbook script code already is (e.g.
 * why it can't be a story variable).
 *
 * @param name Bare name.
 * @returns What the name already is, or undefined if it can be a story variable.
 */
export function whatExcludedBareNameIs(name: string): string | undefined {
    if (excludedNames.has(name)) return "a Chapbook built-in";
    if (isEcmaScriptGlobal(name)) return "a JavaScript global";
    if (browserGlobals.has(name)) return "a browser global";
    return undefined;
}

/**
 * Create an extractor for Chapbook script code.
 *
 * @param options Extractor options.
 * @param options.recordRootDeclarations True to also record root-level
 * declarations for filtering conditional references against. Only
 * code that shares the story's script scope (`script` passages and story
 * script files) should do so.
 */
export function createChapbookScriptExtractor({
    recordRootDeclarations,
}: {
    recordRootDeclarations: boolean;
}): ScriptSymbolExtractor {
    /*
     * Story variables and properties only come from `engine.state.get`/`set`/`setDefault`
     * with a literal key (or a never-reassigned alias of `engine.state`). A `set`/`setDefault`
     * whose value could be an object of unknown shape marks its path opaque.
     * An unbound bare `config` is a story variable; every other unbound bare name is a
     * conditional reference. Escaped spellings (`g\u006FLd`) and declarations are rejected.
     */
    return ({ ast, text, scopeManager, isGlobalName }) => {
        const variables: ScriptVariableOccurrence[] = [];
        const properties: ScriptPropertyOccurrence[] = [];
        const { isUnbound, staticKeyName, memberName, aliasRoot } =
            createScriptAnalysis(text, scopeManager);

        // `engine.state`, or a never-reassigned alias of it
        const isEngineState = (node: acorn.Node): boolean => {
            if (node.type === "Identifier") {
                return !!aliasRoot(node as acorn.Identifier, isEngineState);
            }
            if (node.type !== "MemberExpression") return false;
            const member = node as acorn.MemberExpression;
            return (
                memberName(member)?.name === "state" &&
                member.object.type === "Identifier" &&
                (member.object as acorn.Identifier).name === "engine" &&
                isUnbound(member.object)
            );
        };

        // `engine.state.get`/`set`/`setDefault` call w/a literal key
        const engineStateCall = (
            node: acorn.AnyNode,
        ):
            | { method: "get" | "set" | "setDefault"; key: StaticName }
            | undefined => {
            if (
                node.type !== "CallExpression" ||
                node.callee.type !== "MemberExpression" ||
                !isEngineState(node.callee.object)
            )
                return undefined;
            const method = memberName(node.callee)?.name;
            if (method !== "get" && method !== "set" && method !== "setDefault")
                return undefined;
            const key =
                node.arguments[0] && staticKeyName(node.arguments[0], true);
            return key ? { method, key } : undefined;
        };

        // Key of an `engine.state.get` call, so we can ignore a self-reference
        // like `set('inv', get('inv') || {})`
        const statePathOf = (node: acorn.AnyNode): string | undefined => {
            if (node.type === "ChainExpression") {
                return statePathOf(node.expression);
            }
            const call = engineStateCall(node);
            return call?.method === "get" ? call.key.name : undefined;
        };

        acornWalk.full(ast, (rawNode) => {
            const node = rawNode as acorn.AnyNode;
            const call = engineStateCall(node);
            if (!call) return;
            const { method, key } = call;
            const segments = key.name.split(".");
            if (!segments.every((s) => isIdentifierName(s))) return;

            const assigned = method !== "get";
            const shape = assigned
                ? argumentShape(
                      (node as acorn.CallExpression).arguments[1],
                      key.name,
                      statePathOf,
                  )
                : {};
            let at = key.start;
            segments.forEach((segment, i) => {
                const flag = shapeFlags(i === segments.length - 1 ? shape : {});
                if (i === 0) {
                    variables.push({ text: segment, at, assigned, ...flag });
                } else {
                    properties.push({
                        text: segment,
                        at,
                        scope: segments.slice(0, i).join("."),
                        assigned,
                        isCallee: false,
                        ...flag,
                    });
                }
                at += segment.length + 1;
            });
        });

        // Keyed by position so a read-and-write like `a += 1` yields one occurrence
        const bareNames = new Map<number, ScriptVariableOccurrence>();
        for (const scope of scopeManager.scopes) {
            for (const ref of scope.references) {
                if (ref.resolved) continue;
                const name = ref.identifier.name;
                if (
                    !name ||
                    name === MISSING_IDENTIFIER ||
                    excludedNames.has(name) ||
                    isGlobalName(name)
                )
                    continue;
                const id = ref.identifier as unknown as acorn.Node;
                if (text.slice(id.start, id.end) !== name) continue;
                bareNames.set(id.start, {
                    text: name,
                    at: id.start,
                    assigned: false,
                    ...(storyVariableNames.has(name) // Skip known not-cond-reference names
                        ? {}
                        : { role: "conditional-reference" as const }),
                });
            }
        }
        variables.push(...bareNames.values());

        if (recordRootDeclarations) {
            for (const scope of scopeManager.scopes) {
                if (scope.type !== "global" && scope.type !== "module")
                    continue;
                for (const variable of scope.variables) {
                    for (const def of variable.defs) {
                        if (
                            def.type !== "Variable" &&
                            def.type !== "FunctionName" &&
                            def.type !== "ClassName"
                        )
                            continue;
                        variables.push({
                            text: def.name.name,
                            at: (def.name as unknown as acorn.Node).start,
                            assigned: false,
                            role: "root-declaration",
                        });
                    }
                }
            }
        }

        variables.sort((a, b) => a.at - b.at);
        properties.sort((a, b) => a.at - b.at);
        return { variables, properties };
    };
}
