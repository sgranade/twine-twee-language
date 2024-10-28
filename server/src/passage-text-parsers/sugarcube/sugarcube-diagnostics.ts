import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { DiagnosticsOptions } from "../../server-options";
import { allMacros } from "./macros";
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
    // Since all we do at this point is validate if the macro exists, if the user
    // doesn't care about that, we can bail
    if (!diagnosticsOptions.warnings.unknownMacro) return [];

    const diagnostics: Diagnostic[] = [];
    const macros = allMacros();

    for (const macroRef of index.getReferences(
        document.uri,
        OSugarCubeSymbolKind.UnknownMacro
    ) ?? []) {
        if (macros[macroRef.contents] === undefined) {
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
