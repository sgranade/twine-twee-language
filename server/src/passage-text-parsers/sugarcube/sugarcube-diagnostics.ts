import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Location,
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
    const definedMacroNames = new Set([...allMacroDefs.map((d) => d.contents)]);

    // Check for bad macro (widget) definitions
    const localMacroDefs = index.getDefinitions(
        document.uri,
        OSugarCubeSymbolKind.KnownMacro
    );
    if (localMacroDefs?.length) {
        // Count up our macro definitions per macro
        const macroDefLocs: Record<string, Location[]> = {};
        for (const macroDef of allMacroDefs) {
            if (macroDefLocs[macroDef.contents] === undefined) {
                macroDefLocs[macroDef.contents] = [];
            }
            macroDefLocs[macroDef.contents].push(macroDef.location);
        }

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
            } else if ((macroDefLocs[macroDef.contents] || []).length > 1) {
                // Otherwise see if we got defined twice
                const diagnostic = Diagnostic.create(
                    macroDef.location.range,
                    `Widget "${macroDef.contents}" can't be defined more than once`,
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                );
                // See if we can find the other location where it's been defined
                for (const loc of macroDefLocs[macroDef.contents] || []) {
                    if (
                        loc.uri !== macroDef.location.uri ||
                        loc.range.start.line !==
                            macroDef.location.range.start.line ||
                        loc.range.start.character !==
                            macroDef.location.range.start.character
                    ) {
                        diagnostic.relatedInformation = [
                            DiagnosticRelatedInformation.create(
                                loc,
                                `Other definition of "${macroDef.contents}"`
                            ),
                        ];
                        break;
                    }
                }
                diagnostics.push(diagnostic);
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
                !definedMacroNames.has(macroRef.contents)
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
