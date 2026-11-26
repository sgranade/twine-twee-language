import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import * as eslintScope from "eslint-scope";

import {
    argumentShape,
    assignmentShape,
    extractSymbols,
    assignedValue,
    isWriteTarget,
    memberChainProperties,
    objectLiteralProperties,
    ScriptPropertyOccurrence,
    ScriptSymbolExtractor,
    ScriptVariableOccurrence,
    StaticPathOf,
    storyPathOf,
} from "../../js-parser";
import { shapeFlags, shorthandFlag, ValueShape } from "../../project-index";
import {
    createScriptAnalysis,
    isIdentifierName,
    StaticName,
} from "../../script-analysis";

type Sigil = "$" | "_";

function isSigil(text: string): text is Sigil {
    return text === "$" || text === "_";
}

function sigilForRootName(name: string | undefined): Sigil | undefined {
    if (name === "variables") return "$";
    if (name === "temporary") return "_";
    return undefined;
}

type StateRootTracer = ReturnType<typeof createStateRootTracer>;

/**
 * Create scope-aware helpers that recognize SugarCube state roots and the
 * story paths reached through them.
 *
 * @param text Text the AST was parsed from.
 * @param scopeManager Scope analysis of the AST.
 * @returns State-root helpers.
 */
function createStateRootTracer(
    text: string,
    scopeManager: eslintScope.ScopeManager,
) {
    const { isUnbound, staticKeyName, memberName, aliasRoot } =
        createScriptAnalysis(text, scopeManager);

    // `State`, `SugarCube.State`, or `window.SugarCube.State`
    const isStateObject = (node: acorn.Node): boolean => {
        if (node.type === "Identifier") {
            return (
                (node as acorn.Identifier).name === "State" && isUnbound(node)
            );
        }
        if (node.type !== "MemberExpression") return false;
        const member = node as acorn.MemberExpression;
        if (memberName(member)?.name !== "State") return false;
        return isSugarCubeObject(member.object);
    };

    const isSugarCubeObject = (node: acorn.Node): boolean => {
        if (node.type === "Identifier") {
            return (
                (node as acorn.Identifier).name === "SugarCube" &&
                isUnbound(node)
            );
        }
        if (node.type !== "MemberExpression") return false;
        const member = node as acorn.MemberExpression;
        if (memberName(member)?.name !== "SugarCube") return false;
        const object = member.object;
        return (
            object.type === "Identifier" &&
            (object as acorn.Identifier).name === "window" &&
            isUnbound(object)
        );
    };

    // Sigil of the state root an expression is, if it is one
    const rootSigil = (node: acorn.Node): Sigil | undefined => {
        switch (node.type) {
            case "MemberExpression": {
                const member = node as acorn.MemberExpression;
                if (!isStateObject(member.object)) return undefined;
                return sigilForRootName(memberName(member)?.name);
            }
            case "CallExpression": {
                const call = node as acorn.CallExpression;
                if (
                    call.callee.type !== "Identifier" ||
                    call.arguments.length > 0 ||
                    !isUnbound(call.callee)
                )
                    return undefined;
                return sigilForRootName((call.callee as acorn.Identifier).name);
            }
            case "Identifier":
                return aliasRoot(node as acorn.Identifier, rootSigil);
        }
        return undefined;
    };

    // Story path a state-root expression stands for (`$a.b` for
    // `variables().a.b` or `State.getVar("$a")`), if it has one
    const statePathOf = (node: acorn.AnyNode): string | undefined => {
        switch (node.type) {
            case "ChainExpression":
                return statePathOf(node.expression);
            case "MemberExpression": {
                const name = memberName(node);
                if (!name) return undefined;
                const sigil = rootSigil(node.object);
                if (sigil) return sigil + name.name;
                const parent = statePathOf(node.object as acorn.AnyNode);
                return parent && `${parent}.${name.name}`;
            }
            case "CallExpression": {
                const call = stateVarCall(node);
                return call?.method === "getVar" ? call.key.name : undefined;
            }
        }
        return undefined;
    };

    // `State.getVar`/`setVar` call with a literal key, if the node is one
    const stateVarCall = (
        node: acorn.CallExpression,
    ): { method: "getVar" | "setVar"; key: StaticName } | undefined => {
        if (node.callee.type !== "MemberExpression") return undefined;
        const method = memberName(node.callee)?.name;
        if (method !== "getVar" && method !== "setVar") return undefined;
        if (!isStateObject(node.callee.object)) return undefined;
        const key = node.arguments[0];
        const literal = key && staticKeyName(key, true);
        return literal ? { method, key: literal } : undefined;
    };

    return { rootSigil, statePathOf, stateVarCall, staticKeyName, memberName };
}

/**
 * Extract SugarCube story variables and properties from JavaScript code.
 */
export const extractSugarCubeScriptSymbols: ScriptSymbolExtractor = ({
    ast,
    text,
    scopeManager,
}) => {
    const tracer = createStateRootTracer(text, scopeManager);
    return extractStateRootSymbols(ast, tracer, tracer.statePathOf);
};

/**
 * Extract story variables and properties from desugared TwineScript.
 */
export const extractTwineScriptSymbols: ScriptSymbolExtractor = ({
    ast,
    text,
    scopeManager,
    isGlobalName,
    isAssignmentContext,
}) => {
    // A story variable is either a sigiled name, found by the default extractor,
    // or reached through a state root, as in script code. Copies through either
    // kind record their story path as a shape source: a state root's path is
    // sigiled (`$a`), and a sigiled name's is left desugared (`Xa`) for the
    // caller to resugar.
    const tracer = createStateRootTracer(text, scopeManager);
    const defaultPathOf = storyPathOf(isGlobalName);
    const pathOf: StaticPathOf = (node) =>
        tracer.statePathOf(node) ?? defaultPathOf(node);
    const sigiled = extractSymbols(ast, isGlobalName, isAssignmentContext, {
        pathOf,
    });
    const stateRooted = extractStateRootSymbols(ast, tracer, pathOf);
    return {
        variables: [...sigiled.variables, ...stateRooted.variables].sort(
            (a, b) => a.at - b.at,
        ),
        properties: [...sigiled.properties, ...stateRooted.properties].sort(
            (a, b) => a.at - b.at,
        ),
    };
};

/**
 * Extract story variables and properties reached through state roots.
 *
 * @param ast Parsed code.
 * @param tracer State-root helpers for the code.
 * @param pathOf Gets an expression's story path, to find shape sources.
 * @returns Variable and property occurrences, in ascending order of position.
 */
function extractStateRootSymbols(
    ast: acorn.Node,
    { rootSigil, stateVarCall, staticKeyName, memberName }: StateRootTracer,
    pathOf: StaticPathOf,
): {
    variables: ScriptVariableOccurrence[];
    properties: ScriptPropertyOccurrence[];
} {
    const variables: ScriptVariableOccurrence[] = [];
    const properties: ScriptPropertyOccurrence[] = [];

    const addVariable = (
        sigil: Sigil,
        name: StaticName,
        {
            assigned,
            shorthand = false,
            shape = {},
        }: { assigned: boolean; shorthand?: boolean; shape?: ValueShape },
    ) => {
        if (!isIdentifierName(name.name)) return;
        variables.push({
            text: sigil + name.name,
            rangeText: name.name,
            at: name.start,
            assigned,
            sigilOutsideRange: true,
            ...shorthandFlag({ shorthand }),
            ...shapeFlags(shape),
        });
    };

    acornWalk.fullAncestor(ast, (rawNode, _, ancestors) => {
        const node = rawNode as acorn.AnyNode;
        switch (node.type) {
            case "MemberExpression": {
                const sigil = rootSigil(node.object);
                if (!sigil) break;
                const name = memberName(node);
                if (!name) break;

                const written = isWriteTarget(node, ancestors, true);
                addVariable(sigil, name, {
                    assigned: written,
                    shape: written
                        ? assignmentShape(node, ancestors, pathOf)
                        : {},
                });
                if (written) {
                    properties.push(
                        ...objectLiteralProperties(
                            assignedValue(node, ancestors),
                            sigil + name.name,
                            pathOf,
                            { assigned: true },
                        ),
                    );
                }

                properties.push(
                    ...memberChainProperties(
                        node,
                        sigil + name.name,
                        ancestors,
                        memberName,
                        pathOf,
                    ),
                );
                break;
            }

            case "VariableDeclarator": {
                if (node.id.type !== "ObjectPattern" || !node.init) break;
                const sigil = rootSigil(node.init);
                if (sigil) captureDestructuring(node.id, sigil);
                break;
            }

            case "AssignmentExpression": {
                if (node.left.type !== "ObjectPattern") break;
                const sigil = rootSigil(node.right);
                if (sigil) captureDestructuring(node.left, sigil);
                break;
            }

            case "CallExpression": {
                const call = stateVarCall(node);
                if (!call) break;
                const literal = call.key;
                const sigil = literal.name[0];
                if (!isSigil(sigil)) break;
                const isSet = call.method === "setVar";
                addVariable(
                    sigil,
                    { name: literal.name.slice(1), start: literal.start + 1 },
                    {
                        assigned: isSet,
                        shape: isSet
                            ? argumentShape(
                                  node.arguments[1],
                                  literal.name,
                                  pathOf,
                              )
                            : {},
                    },
                );
                if (isSet && isIdentifierName(literal.name.slice(1))) {
                    properties.push(
                        ...objectLiteralProperties(
                            node.arguments[1],
                            literal.name,
                            pathOf,
                            { assigned: true },
                        ),
                    );
                }
                break;
            }
        }
    });

    function captureDestructuring(pattern: acorn.ObjectPattern, sigil: Sigil) {
        for (const prop of pattern.properties) {
            if (prop.type !== "Property") continue;
            const name = staticKeyName(prop.key, prop.computed);
            if (name)
                addVariable(sigil, name, {
                    assigned: false,
                    shorthand: prop.shorthand,
                });
        }
    }

    variables.sort((a, b) => a.at - b.at);
    properties.sort((a, b) => a.at - b.at);
    return { variables, properties };
}
