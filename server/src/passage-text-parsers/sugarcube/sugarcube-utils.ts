import { JSPropertyLabel, JSVariableLabel } from "../../js-parser";
import { ParsingState } from "../../parser";
import { builtinVars, builtInVarsAndProperties } from "./sugarcube-variables";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Create symbol references for parsed variables and properties.
 *
 * `isSet` overrides the individual label's set (defined) information.
 *
 * @param varsAndProps Tuple with separate lists of variables and properties.
 * @param state Parsing state.
 * @param isSet True if the variables and properties are being set (assigned to).
 */
export function createVariableAndPropertyReferences(
    varsAndProps: [JSVariableLabel[], JSPropertyLabel[]],
    state: ParsingState,
    isSet = false,
): void {
    for (const v of varsAndProps[0]) {
        // Don't save any references to SugarCube-specific variables
        if (!builtinVars.has(v.contents))
            state.callbacks.onSymbolReference({
                contents: v.contents,
                location: v.location,
                kind:
                    isSet || v.defined
                        ? OSugarCubeSymbolKind.VariableSet
                        : OSugarCubeSymbolKind.Variable,
            });
    }
    for (const p of varsAndProps[1]) {
        // If there's a prefix, add it to the name, b/c we save properties in their
        // full object context (ex: `var.prop.subprop`).
        let contents =
            p.prefix !== undefined ? `${p.prefix}.${p.contents}` : p.contents;

        // Handle `State.temporary.<var>` and `State.variables.<var>`, which in
        // JavaScript correspond to Twinescript `_var` and `$var`, respectively.
        if (contents.startsWith("State.")) {
            let isVariable = false;
            let isTemporary = false;
            if (contents.startsWith("State.temporary.")) {
                isVariable = true;
                isTemporary = true;
            } else if (contents.startsWith("State.variables.")) {
                isVariable = true;
                isTemporary = false;
            }
            if (isVariable) {
                const varPrefix = isTemporary ? "_" : "$";
                contents = contents.slice(16);
                const firstPeriodNdx = contents.indexOf(".");
                if (firstPeriodNdx === -1) {
                    // This is the property corresponding to the root variable: State.variable.var
                    state.callbacks.onSymbolReference({
                        contents: varPrefix + contents,
                        location: p.location,
                        kind:
                            isSet || p.defined
                                ? OSugarCubeSymbolKind.VariableSet
                                : OSugarCubeSymbolKind.Variable,
                    });
                } else {
                    // This corresponds to a property: State.variable.var.prop
                    state.callbacks.onSymbolReference({
                        contents: varPrefix + contents,
                        location: p.location,
                        kind:
                            isSet || p.defined
                                ? OSugarCubeSymbolKind.PropertySet
                                : OSugarCubeSymbolKind.Property,
                    });
                }

                continue;
            }
        }

        // Don't save any references to SugarCube-specific properties
        if (!builtInVarsAndProperties.has(contents))
            state.callbacks.onSymbolReference({
                contents: contents,
                location: p.location,
                kind:
                    isSet || p.defined
                        ? OSugarCubeSymbolKind.PropertySet
                        : OSugarCubeSymbolKind.Property,
            });
    }
}
