import {
    Diagnostic,
    DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "@tt3/shared";
import {
    createDiagnosticFromRange,
    referencesToDiagnostics,
} from "../../diagnostics";
import { ProjectIndex } from "../../project-index";
import { generateNeverAssignedToDiagnostics } from "../assignments";
import { allBuiltInMacros, allMacros } from "./macros";
import { getSugarCubeDefinitions } from "./sugarcube-parser";
import { builtinVars, builtInVarsAndProperties } from "./sugarcube-variables";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Generate diagnostics involving macros.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param text Text of the document.
 * @returns List of diagnostic messages.
 */
function generateMacroDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const macros = allMacros();
    const builtInMacros = allBuiltInMacros();
    const allMacroDefs = getSugarCubeDefinitions(
        OSugarCubeSymbolKind.KnownMacro,
        index,
    );
    const definedMacroNames = allMacroDefs.map((d) => d.contents);

    // Check for bad macro (widget) definitions
    const localMacroDefs = index.getDefinitions(
        document.uri,
        OSugarCubeSymbolKind.KnownMacro,
    );
    if (localMacroDefs?.length) {
        for (const macroDef of localMacroDefs) {
            // See if we're undefined and don't have the same name as a built-in macro
            if (
                builtInMacros[macroDef.contents] !== undefined &&
                !index.diagnosticIsDisabled(
                    document.uri,
                    DiagnosticCodes.SugarCubeNoWidgetWithBuiltInMacroName,
                    macroDef.location.range,
                )
            ) {
                diagnostics.push(
                    createDiagnosticFromRange(
                        DiagnosticCodes.SugarCubeNoWidgetWithBuiltInMacroName,
                        macroDef.location.range,
                    ),
                );
            } else {
                // See if we got defined twice
                const ndx1 = definedMacroNames.indexOf(macroDef.contents);
                const ndx2 = definedMacroNames.lastIndexOf(macroDef.contents);
                if (
                    ndx1 !== ndx2 &&
                    !index.diagnosticIsDisabled(
                        document.uri,
                        DiagnosticCodes.SugarCubeNoMultipleWidgetDefinitions,
                        macroDef.location.range,
                    )
                ) {
                    const diagnostic = createDiagnosticFromRange(
                        DiagnosticCodes.SugarCubeNoMultipleWidgetDefinitions,
                        macroDef.location.range,
                    );
                    // Find the other location where it's been defined
                    let loc = allMacroDefs[ndx1].location;
                    if (
                        loc.uri === macroDef.location.uri &&
                        loc.range.start.line ===
                            macroDef.location.range.start.line &&
                        loc.range.start.character ===
                            macroDef.location.range.start.character
                    ) {
                        loc = allMacroDefs[ndx2].location;
                    }
                    diagnostic.relatedInformation = [
                        DiagnosticRelatedInformation.create(
                            loc,
                            `Other definition of "${macroDef.contents}"`,
                        ),
                    ];
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    // See if we have unknown macros
    for (const macroRef of index.getReferences(
        document.uri,
        OSugarCubeSymbolKind.UnknownMacro,
    ) ?? []) {
        if (
            macros[macroRef.contents] === undefined &&
            definedMacroNames.indexOf(macroRef.contents) === -1
        ) {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    macroRef,
                    DiagnosticCodes.SugarCubeUnknownMacro,
                ),
            );
        }
    }

    return diagnostics;
}

/**
 * Generate SugarCube-specific diagnostics.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
export function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for variables/properties that don't have a setter
    diagnostics.push(
        ...generateNeverAssignedToDiagnostics(document.uri, index, {
            variableKind: OSugarCubeSymbolKind.Variable,
            variableSetKind: OSugarCubeSymbolKind.VariableSet,
            propertyKind: OSugarCubeSymbolKind.Property,
            propertySetKind: OSugarCubeSymbolKind.PropertySet,
            builtInVariables: builtinVars,
            builtInProperties: builtInVarsAndProperties,
            indexedBuiltInVariables: ["setup"],
            message:
                "This isn't set in any <<set>> macro, setter link, or JavaScript section; make sure you've spelled it correctly.",
        }),
    );
    // Check for unrecognized macros
    diagnostics.push(...generateMacroDiagnostics(document, index));

    return diagnostics;
}
