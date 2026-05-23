import { JSPropertyLabel, JSVariableLabel } from "../../js-parser";
import { ParsingState } from "../../parser";
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
        const contents =
            p.prefix !== undefined ? `${p.prefix}.${p.contents}` : p.contents;
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
