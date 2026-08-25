import { DiagnosticCodes } from "@tt3/shared";
import { createDiagnosticFromRange } from "../../diagnostics";
import { TokenizedJS } from "../../js-parser";
import { logDiagnosticFor, logRawDiagnostic, ParsingState } from "../../parser";
import { positionInRange } from "../../utilities";
import { SugarCubeParsingState } from "./sugarcube-parser";
import { builtinVars, builtInVarsAndProperties } from "./sugarcube-variables";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Create symbol references for tokenized variables and properties, and log any tokenizing error.
 *
 * `isSet` overrides the individual label's set (defined) information.
 *
 * @param jsTokens Tokenized JavaScript variables and properties, as well as any parsing error.
 * @param state Parsing state.
 * @param isSet True if the variables and properties are being set (assigned to).
 */
export function createVariableAndPropertyReferences(
    jsTokens: TokenizedJS,
    state: ParsingState,
    sugarcubeState: SugarCubeParsingState,
    isSet = false,
): void {
    for (const v of jsTokens.variables) {
        // Special case the built-in variables `$args`, `_args`, and `_contents`, which only
        // exist inside of a <<widget>> container macro. The vars can show up in child
        // macros (in which case there will be an open widget macro in the state) or
        // as bare variables (which are parsed later and thus require checking the
        // stored ranges of widget macros)
        if (
            v.contents === "$args" ||
            v.contents === "_args" ||
            v.contents === "_contents"
        ) {
            if (
                !sugarcubeState.unclosedMacros.find(
                    (p) => p.name === "widget",
                ) &&
                !sugarcubeState.widgetMacroRanges.find((r) =>
                    positionInRange(v.location.range.start, r),
                )
            ) {
                logRawDiagnostic(
                    createDiagnosticFromRange(
                        DiagnosticCodes.SugarCubeUnexpectedWidgetVariable,
                        v.location.range,
                        `${v.contents} typically only exists inside <<widget>> macros. If this variable name is correct, consider renaming it.`,
                    ),
                    state,
                );
            }
        }
        // Don't capture the auto-generated variable `output` in a <<script>> macro
        else if (
            v.contents === "output" &&
            sugarcubeState.unclosedMacros.find((p) => p.name === "script")
        ) {
            // Do nothing!
        }
        // Don't save any references to SugarCube-specific variables
        else if (!builtinVars.has(v.contents))
            state.callbacks.onSymbolReference({
                contents: v.contents,
                location: v.location,
                kind:
                    isSet || v.defined
                        ? OSugarCubeSymbolKind.VariableSet
                        : OSugarCubeSymbolKind.Variable,
            });
    }
    for (const p of jsTokens.properties) {
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
                const ref = {
                    contents: (isTemporary ? "_" : "$") + contents.slice(16),
                    location: p.location,
                    defined: p.defined,
                };
                const firstPeriodNdx = ref.contents.indexOf(".");
                if (firstPeriodNdx === -1) {
                    // This is the property corresponding to the root variable: State.variable.var
                    createVariableAndPropertyReferences(
                        { variables: [ref], properties: [] },
                        state,
                        sugarcubeState,
                    );
                } else {
                    // This corresponds to a property: State.variable.var.prop
                    createVariableAndPropertyReferences(
                        { variables: [], properties: [ref] },
                        state,
                        sugarcubeState,
                    );
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
    if (jsTokens.error) {
        logDiagnosticFor(
            DiagnosticCodes.IncorrectJavaScript,
            jsTokens.error.contents,
            jsTokens.error.at,
            state,
            jsTokens.error.message,
        );
    }
}
