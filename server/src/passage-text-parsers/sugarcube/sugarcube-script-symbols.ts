import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import * as eslintScope from "eslint-scope";

import {
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
    storyVarSetArgumentShape,
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

// SugarCube globals whose properties are indexed in script code
const objectRoots = ["setup", "settings"] as const;
type ObjectRoot = (typeof objectRoots)[number];

// How a `Setting` method uses the setting its first argument names: `define`
// creates it w/a known value, `set` writes its second argument, and `read`
// reads it. n.b. SugarCube added `addRange` in 2.26.0 and `addValue`,
// `getValue` and `setValue` in 2.37.0, but all are recognized whatever
// version a project targets. `addHeader` names no setting.
type SettingUse = "define" | "set" | "read";
const settingMethods: ReadonlyMap<string, SettingUse> = new Map([
    ["addToggle", "define"],
    ["addList", "define"],
    ["addRange", "define"],
    ["addValue", "define"],
    ["setValue", "set"],
    ["getValue", "read"],
]);

type RootTracer = ReturnType<typeof createRootTracer>;

/**
 * Create scope-aware helpers that recognize SugarCube's roots in script code
 * and the story paths reached through them: state roots, which reach story
 * variables, `setup`, which reaches setup properties, and `settings`, which
 * reaches settings.
 *
 * @param text Text the AST was parsed from.
 * @param scopeManager Scope analysis of the AST.
 * @returns Root helpers.
 */
function createRootTracer(
    text: string,
    scopeManager: eslintScope.ScopeManager,
) {
    const {
        isUnbound,
        staticKeyName,
        memberName,
        aliasRoot,
        objectAssignCall,
    } = createScriptAnalysis(text, scopeManager);
    // A SugarCube global: `name`, `SugarCube.name`, or
    // `window.SugarCube.name`
    const isSugarCubeGlobal = (node: acorn.Node, name: string): boolean => {
        if (node.type === "Identifier") {
            return (node as acorn.Identifier).name === name && isUnbound(node);
        }
        if (node.type !== "MemberExpression") return false;
        const member = node as acorn.MemberExpression;
        return (
            memberName(member)?.name === name &&
            isSugarCubeObject(member.object)
        );
    };

    const isStateObject = (node: acorn.Node): boolean =>
        isSugarCubeGlobal(node, "State");

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

    // Story variable a state-root expression names directly (`$a` for
    // `variables().a` or `State.getVar("$a")`), if it names one
    const stateRootPath = (node: acorn.AnyNode): string | undefined => {
        if (node.type === "MemberExpression") {
            const name = memberName(node);
            const sigil = name && rootSigil(node.object);
            return sigil ? sigil + name.name : undefined;
        }
        if (node.type === "CallExpression") {
            const call = stateVarCall(node);
            return call?.method === "getVar" ? call.key.name : undefined;
        }
    };

    // The object root an expression is, if it's SugarCube's `setup` or
    // `settings` or a never-reassigned alias of one.
    const objectRootPath = (node: acorn.Node): ObjectRoot | undefined => {
        const root = objectRoots.find((name) => isSugarCubeGlobal(node, name));
        if (root) return root;
        // This doesn't include `window.setup` or `window.settings`, since
        // SugarCube doesn't add them there
        return node.type === "Identifier"
            ? aliasRoot(node as acorn.Identifier, objectRootPath)
            : undefined;
    };

    // Build a getter for the path an expression stands for: the path its
    // root gives, extended by each static member after it (`$a.b` for
    // `variables().a.b`)
    const pathThrough = (
        rootPath: (node: acorn.AnyNode) => string | undefined,
    ): StaticPathOf => {
        const pathOf: StaticPathOf = (node) => {
            const root = rootPath(node);
            if (root) return root;
            if (node.type === "ChainExpression") return pathOf(node.expression);
            if (node.type !== "MemberExpression") return undefined;
            const name = memberName(node);
            const parent = name && pathOf(node.object as acorn.AnyNode);
            return parent ? `${parent}.${name.name}` : undefined;
        };
        return pathOf;
    };

    // Call of one of a SugarCube global's methods w/a literal first
    // argument (`State.getVar("$a")`), if the node is one
    const literalKeyCall = <M extends string>(
        node: acorn.CallExpression,
        global: string,
        isMethod: (name: string) => name is M,
    ): { method: M; key: StaticName } | undefined => {
        if (node.callee.type !== "MemberExpression") return undefined;
        const method = memberName(node.callee)?.name;
        if (method === undefined || !isMethod(method)) return undefined;
        if (!isSugarCubeGlobal(node.callee.object, global)) return undefined;
        const key = node.arguments[0];
        const literal = key && staticKeyName(key, true);
        return literal ? { method, key: literal } : undefined;
    };

    // `State.getVar`/`setVar` call with a literal key, if the node is one
    const stateVarCall = (
        node: acorn.CallExpression,
    ): { method: "getVar" | "setVar"; key: StaticName } | undefined =>
        literalKeyCall(
            node,
            "State",
            (name): name is "getVar" | "setVar" =>
                name === "getVar" || name === "setVar",
        );

    // `Setting` call that names a setting w/a literal key, if the node
    // is one. A key that isn't an identifier isn't a setting since
    // then you can't do `settings.<key>`.
    const settingCall = (
        node: acorn.CallExpression,
    ): { use: SettingUse; key: StaticName } | undefined => {
        const call = literalKeyCall(node, "Setting", (name): name is string =>
            settingMethods.has(name),
        );
        if (!call || !isIdentifierName(call.key.name)) return undefined;
        return { use: settingMethods.get(call.method)!, key: call.key };
    };

    return {
        rootSigil,
        statePathOf: pathThrough(stateRootPath),
        objectPathOf: pathThrough(objectRootPath),
        objectRootPath,
        settingCall,
        stateVarCall,
        staticKeyName,
        memberName,
        objectAssignCall,
    };
}

/**
 * Extract SugarCube story variables and properties, and setup and
 * settings object properties, from JavaScript code.
 */
export const extractSugarCubeScriptSymbols: ScriptSymbolExtractor = ({
    ast,
    text,
    scopeManager,
}) => {
    /**
     * In script code a story variable is reached only through a state root:
     * `State.variables`, `State.temporary`, `variables()`, `temporary()`,
     * `SugarCube.State.*` (w/ or w/o `window.`), or `State.getVar`/`setVar`
     * w/ a literal key. A setup property is reached through `setup`, or
     * `SugarCube.setup` (w/ or w/o `window.`), and a setting the same way
     * through `settings`. A `Setting` call with a literal name (`addToggle`,
     * `getValue`, …) also reaches a setting. A never-reassigned binding
     * initialized with any kind of root is also that kind of root. Bare
     * identifiers are never story variables.
     */
    const tracer = createRootTracer(text, scopeManager);
    const pathOf: StaticPathOf = (node) =>
        tracer.statePathOf(node) ?? tracer.objectPathOf(node);
    const stateRooted = extractStateRootSymbols(ast, tracer, pathOf);
    return {
        variables: stateRooted.variables,
        properties: [
            ...stateRooted.properties,
            ...extractObjectRootProperties(ast, tracer, pathOf),
        ].sort((a, b) => a.at - b.at),
    };
};

/**
 * Extract setup properties and settings from SugarCube JavaScript code.
 *
 * @param ast Parsed code.
 * @param tracer Root helpers for the code.
 * @param pathOf Gets an expression's story, setup, or settings path, to find
 * shape sources and recognize a self-reference.
 * @returns Property occurrences.
 */
function extractObjectRootProperties(
    ast: acorn.Node,
    {
        objectRootPath,
        objectPathOf,
        settingCall,
        memberName,
        staticKeyName,
        objectAssignCall,
    }: RootTracer,
    pathOf: StaticPathOf,
): ScriptPropertyOccurrence[] {
    const properties: ScriptPropertyOccurrence[] = [];

    // Reads of a destructured setup or setting path's keys (`a` in
    // `const { a } = setup`)
    const captureDestructuring = (
        pattern: acorn.ObjectPattern,
        source: acorn.AnyNode,
    ) => {
        const path = objectPathOf(source);
        if (!path) return;
        for (const prop of pattern.properties) {
            if (prop.type !== "Property") continue;
            const name = staticKeyName(prop.key, prop.computed);
            if (name) {
                properties.push({
                    text: name.name,
                    at: name.start,
                    scope: path,
                    assigned: false,
                    isCallee: false,
                });
            }
        }
    };

    acornWalk.fullAncestor(ast, (rawNode, _, ancestors) => {
        const node = rawNode as acorn.AnyNode;
        switch (node.type) {
            case "MemberExpression": {
                const root = objectRootPath(node.object);
                if (!root) break;
                properties.push(
                    ...memberChainProperties(
                        node.object,
                        root,
                        [...ancestors, node.object],
                        memberName,
                        pathOf,
                    ),
                );
                break;
            }

            case "CallExpression": {
                const setting = settingCall(node);
                if (setting) {
                    const { key, use } = setting;
                    const path = `settings.${key.name}`;
                    // A defined setting's shape is known; a set one takes
                    // its value argument's shape
                    const value = node.arguments[1];
                    const isSet = use === "set";
                    properties.push({
                        text: key.name,
                        at: key.start,
                        scope: "settings",
                        assigned: use !== "read",
                        isCallee: false,
                        ...shapeFlags(
                            isSet
                                ? storyVarSetArgumentShape(value, path, pathOf)
                                : {},
                        ),
                    });
                    if (isSet) {
                        properties.push(
                            ...objectLiteralProperties(value, path, pathOf, {
                                assigned: true,
                            }),
                        );
                    }
                    break;
                }
                const assign = objectAssignCall(node);
                const path = assign && objectPathOf(assign.target);
                if (!assign || !path) break;
                for (const source of assign.sources) {
                    properties.push(
                        ...objectLiteralProperties(source, path, pathOf, {
                            assigned: true,
                        }),
                    );
                }
                break;
            }

            case "VariableDeclarator":
                if (node.id.type === "ObjectPattern" && node.init)
                    captureDestructuring(node.id, node.init);
                break;

            case "AssignmentExpression":
                if (node.left.type === "ObjectPattern")
                    captureDestructuring(node.left, node.right);
                break;
        }
    });
    return properties;
}

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
    const tracer = createRootTracer(text, scopeManager);
    const defaultPathOf = storyPathOf(isGlobalName);
    const pathOf: StaticPathOf = (node) =>
        tracer.statePathOf(node) ??
        tracer.objectPathOf(node) ??
        defaultPathOf(node);
    const sigiled = extractSymbols(ast, isGlobalName, {
        isAssignmentContext,
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
 * @param tracer Root helpers for the code.
 * @param pathOf Gets an expression's story path, to find shape sources.
 * @returns Variable and property occurrences, in ascending order of position.
 */
function extractStateRootSymbols(
    ast: acorn.Node,
    { rootSigil, stateVarCall, staticKeyName, memberName }: RootTracer,
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
                            ? storyVarSetArgumentShape(
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
