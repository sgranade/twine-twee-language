import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import type * as eslintScope from "eslint-scope";

import {
    isCallee,
    isWriteTarget,
    parentOf,
    ScriptPropertyOccurrence,
    ScriptSymbolExtractor,
    ScriptVariableOccurrence,
} from "../../js-parser";

type Sigil = "$" | "_";

const identifierRegexp = /^[A-Za-z_$][\w$]*$/;
const getSetVarKeyRegexp = /^([$_])([A-Za-z_$][\w$]*)$/;

function sigilForRootName(name: string | undefined): Sigil | undefined {
    if (name === "variables") return "$";
    if (name === "temporary") return "_";
    return undefined;
}

/**
 * A statically-known name and where it sits in the source.
 */
interface StaticName {
    name: string;
    start: number;
}

/**
 * Extract story variables and properties from JavaScript code.
 */
export const extractSugarCubeScriptSymbols: ScriptSymbolExtractor = ({
    ast,
    text,
    scopeManager,
}) => {
    const variables: ScriptVariableOccurrence[] = [];
    const properties: ScriptPropertyOccurrence[] = [];

    /*
     * To get to a story variable in JavaScript, you have to use `State.variables`,
     * `State.temporary`, `variables()`, `temporary()`, `SugarCube.State.*` (which
     * can include `window.`), or `State.getVar`/`setVar` w/a literal key.
     */
    const references = new Map<acorn.Node, eslintScope.Reference>();
    for (const scope of scopeManager.scopes) {
        for (const ref of scope.references) {
            references.set(ref.identifier as unknown as acorn.Node, ref);
        }
    }

    const isUnbound = (id: acorn.Node): boolean => {
        const ref = references.get(id);
        return !!ref && !ref.resolved;
    };

    // A name is only static if its source spelling is the plain name, so
    // we don't index escapes like '\x66oo'
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

    const isPlainStringSource = (node: acorn.Node, value: string): boolean =>
        text.slice(node.start + 1, node.end - 1) === value;

    const memberName = (node: acorn.MemberExpression): StaticName | undefined =>
        staticKeyName(node.property, node.computed);

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

    const aliasSigils = new Map<eslintScope.Variable, Sigil | undefined>();

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
                return aliasSigil(node as acorn.Identifier);
        }
        return undefined;
    };

    const aliasSigil = (id: acorn.Identifier): Sigil | undefined => {
        const variable = references.get(id)?.resolved;
        if (!variable) return undefined;
        if (aliasSigils.has(variable)) return aliasSigils.get(variable);
        // Guard against self-referential initializers
        aliasSigils.set(variable, undefined);

        let sigil: Sigil | undefined;
        const writes = variable.references.filter((r) => r.isWrite());
        if (
            variable.defs.length === 1 &&
            variable.defs[0].type === "Variable" &&
            variable.defs[0].name.type === "Identifier" &&
            writes.length === 1 &&
            writes[0].init === true
        ) {
            const declarator = variable.defs[0].node as unknown as {
                id: acorn.Node;
                init?: acorn.Node | null;
            };
            if (declarator.id.type === "Identifier" && declarator.init) {
                sigil = rootSigil(declarator.init);
            }
        }
        aliasSigils.set(variable, sigil);
        return sigil;
    };

    const addVariable = (sigil: Sigil, name: StaticName, assigned: boolean) => {
        if (!identifierRegexp.test(name.name)) return; // Don't add non-identifiers
        variables.push({
            text: sigil + name.name,
            rangeText: name.name,
            at: name.start,
            assigned,
            sigilOutsideRange: true,
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
                addVariable(sigil, name, written);

                // Capture properties by walking up through static property accesses
                let current: acorn.AnyNode = node;
                let scope = sigil + name.name;
                let depth = ancestors.length - 2;
                while (depth >= 0) {
                    const up = ancestors[depth] as acorn.AnyNode;
                    if (up.type !== "MemberExpression" || up.object !== current)
                        break;
                    const prop = memberName(up);
                    if (!prop) break;
                    const upAncestors = ancestors.slice(0, depth + 1);
                    properties.push({
                        text: prop.name,
                        at: prop.start,
                        scope,
                        assigned: isWriteTarget(up, upAncestors, true),
                        isCallee: isCallee(up, parentOf(upAncestors)),
                    });
                    scope = `${scope}.${prop.name}`;
                    current = up;
                    depth--;
                }
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
                if (node.callee.type !== "MemberExpression") break;
                const method = memberName(node.callee);
                if (
                    !method ||
                    (method.name !== "getVar" && method.name !== "setVar") ||
                    !isStateObject(node.callee.object)
                )
                    break;
                const key = node.arguments[0];
                if (!key) break;
                const literal = staticKeyName(key, true);
                if (!literal) break;
                const match = getSetVarKeyRegexp.exec(literal.name);
                if (!match) break;
                addVariable(
                    match[1] as Sigil,
                    { name: match[2], start: literal.start + 1 },
                    method.name === "setVar",
                );
                break;
            }
        }
    });

    function captureDestructuring(pattern: acorn.ObjectPattern, sigil: Sigil) {
        for (const prop of pattern.properties) {
            if (prop.type !== "Property") continue;
            const name = staticKeyName(prop.key, prop.computed);
            if (name) addVariable(sigil, name, false);
        }
    }

    variables.sort((a, b) => a.at - b.at);
    properties.sort((a, b) => a.at - b.at);
    return { variables, properties };
};
