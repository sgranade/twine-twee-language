import { JSPropertyLabel } from "../../js-parser";
import { ParsingState } from "../../parser";
import { Label } from "../../project-index";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Create symbol references for parsed variables and properties.
 *
 * @param varsAndProps Tuple with separate lists of variables and properties.
 * @param state Parsing state.
 */
export function createVariableAndPropertyReferences(
    varsAndProps: [Label[], JSPropertyLabel[]],
    state: ParsingState
): void {
    for (const v of varsAndProps[0]) {
        state.callbacks.onSymbolReference({
            contents: v.contents,
            location: v.location,
            kind: OSugarCubeSymbolKind.Variable,
        });
    }
    for (const p of varsAndProps[1]) {
        // If there's a scope, add it to the name, b/c we save properties in their
        // full object context (ex: `var.prop.subprop`).
        const contents =
            p.prefix !== undefined ? `${p.prefix}.${p.contents}` : p.contents;
        state.callbacks.onSymbolReference({
            contents: contents,
            location: p.location,
            kind: OSugarCubeSymbolKind.Property,
        });
    }
}
