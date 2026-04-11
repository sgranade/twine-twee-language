import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { DiagnosticsOptions } from "../../server-options";
import { allBuiltInMacros, allMacros } from "./macros";
import { getSugarCubeDefinitions } from "./sugarcube-parser";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Generate diagnostics involving macros.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param text Text of the document.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
function generateMacroDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    diagnosticsOptions: DiagnosticsOptions
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const macros = allMacros();
    const builtInMacros = allBuiltInMacros();
    const allMacroDefs = getSugarCubeDefinitions(
        OSugarCubeSymbolKind.KnownMacro,
        index
    );
    const definedMacroNames = allMacroDefs.map((d) => d.contents);

    // Check for bad macro (widget) definitions
    const localMacroDefs = index.getDefinitions(
        document.uri,
        OSugarCubeSymbolKind.KnownMacro
    );
    if (localMacroDefs?.length) {
        for (const macroDef of localMacroDefs) {
            // See if we have the same name as a built-in macro
            if (builtInMacros[macroDef.contents] !== undefined) {
                diagnostics.push(
                    Diagnostic.create(
                        macroDef.location.range,
                        `Widget "${macroDef.contents}" can't have the same name as a built-in macro`,
                        DiagnosticSeverity.Error,
                        undefined,
                        "Twine"
                    )
                );
            } else {
                // See if we got defined twice
                const ndx1 = definedMacroNames.indexOf(macroDef.contents);
                const ndx2 = definedMacroNames.lastIndexOf(macroDef.contents);
                if (ndx1 !== ndx2) {
                    const diagnostic = Diagnostic.create(
                        macroDef.location.range,
                        `Widget "${macroDef.contents}" can't be defined more than once`,
                        DiagnosticSeverity.Error,
                        undefined,
                        "Twine"
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
                            `Other definition of "${macroDef.contents}"`
                        ),
                    ];
                    diagnostics.push(diagnostic);
                }
            }
        }
    }

    // See if we have unknown macros
    if (diagnosticsOptions.warnings.unknownMacro) {
        for (const macroRef of index.getReferences(
            document.uri,
            OSugarCubeSymbolKind.UnknownMacro
        ) ?? []) {
            if (
                macros[macroRef.contents] === undefined &&
                definedMacroNames.indexOf(macroRef.contents) === -1
            ) {
                diagnostics.push(
                    ...macroRef.locations.map((loc) =>
                        Diagnostic.create(
                            loc.range,
                            `Macro "${macroRef.contents}" not recognized`,
                            DiagnosticSeverity.Warning,
                            undefined,
                            "Twine"
                        )
                    )
                );
            }
        }
    }

    return diagnostics;
}

/**
 * Generate SugarCube-specific diagnostics.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
export function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    diagnosticsOptions: DiagnosticsOptions
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    // Check for unrecognized macros (if that option is set)
    diagnostics.push(
        ...generateMacroDiagnostics(document, index, diagnosticsOptions)
    );

    return diagnostics;
}
