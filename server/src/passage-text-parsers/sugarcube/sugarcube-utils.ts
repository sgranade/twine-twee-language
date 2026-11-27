import { DiagnosticCodes } from "@tt3/shared";
import { createDiagnosticFromRange } from "../../diagnostics";
import { TokenizedJS } from "../../js-parser";
import { logDiagnostic, logRawDiagnostic } from "../../parser";
import {
    calleeFlag,
    shapeFlags,
    shorthandFlag,
    sigilFlag,
} from "../../project-index";
import { positionInRange } from "../../utilities";
import { ParsingState } from "../types";
import { builtinVars, builtInVarsAndProperties } from "./sugarcube-variables";
import { OSugarCubeSymbolKind, SugarCubeParsingState } from "./types";

function isInScriptMacro(sugarcubeState: SugarCubeParsingState): boolean {
    return sugarcubeState.unclosedMacros.some((p) => p.name === "script");
}

/**
 * Create symbol references for tokenized variables and properties, and log
 * any tokenizing error and diagnostics the script extractor found.
 *
 * `isSet` overrides the individual label's assignment information.
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
        else if (v.contents === "output" && isInScriptMacro(sugarcubeState)) {
            // Do nothing!
        }
        // Don't save any references to SugarCube-specific variables
        else if (!builtinVars.has(v.contents))
            state.callbacks.onSymbolReference({
                contents: v.contents,
                location: v.location,
                kind:
                    isSet || v.assigned
                        ? OSugarCubeSymbolKind.VariableSet
                        : OSugarCubeSymbolKind.Variable,
                ...sigilFlag(v),
                ...shorthandFlag(v),
                ...shapeFlags(v),
            });
    }
    for (const p of jsTokens.properties) {
        // If there's a prefix, add it to the name, b/c we save properties in their
        // full object context (ex: `var.prop.subprop`).
        let contents =
            p.prefix !== undefined ? `${p.prefix}.${p.contents}` : p.contents;

        // Don't capture properties of the auto-generated variable `output` in a <<script>> macro
        if (
            (contents === "output" || contents.startsWith("output.")) &&
            isInScriptMacro(sugarcubeState)
        ) {
            continue;
        }

        // Don't save any references to SugarCube-specific properties
        if (!builtInVarsAndProperties.has(contents))
            state.callbacks.onSymbolReference({
                contents: contents,
                location: p.location,
                kind:
                    isSet || p.assigned
                        ? OSugarCubeSymbolKind.PropertySet
                        : OSugarCubeSymbolKind.Property,
                ...calleeFlag(p),
                ...shapeFlags(p),
            });
    }
    if (jsTokens.error) {
        logDiagnostic(
            DiagnosticCodes.IncorrectJavaScript,
            jsTokens.error.start,
            jsTokens.error.end,
            state,
            jsTokens.error.message,
        );
    }
    for (const diagnostic of jsTokens.diagnostics ?? []) {
        logDiagnostic(
            diagnostic.code,
            diagnostic.start,
            diagnostic.end,
            state,
            diagnostic.message,
        );
    }
}
