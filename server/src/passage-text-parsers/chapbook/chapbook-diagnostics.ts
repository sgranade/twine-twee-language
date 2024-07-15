import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex, References } from "../../project-index";
import { DiagnosticsOptions } from "../../server-options";
import { getChapbookDefinitions, OChapbookSymbolKind } from "./chapbook-parser";

/**
 * Generate Chapbook-specific diagnostics.
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

    // If we're not going to look for undefined macros (in our case, inserts
    // and modifiers), then we've got nothing to do
    if (!diagnosticsOptions.warnings.unknownMacro) return diagnostics;

    const insertReferences: References[] =
        index.getReferences(document.uri, OChapbookSymbolKind.Insert) || [];
    const modifierReferences: References[] =
        index.getReferences(document.uri, OChapbookSymbolKind.Modifier) || [];

    const customInserts = getChapbookDefinitions(
        OChapbookSymbolKind.Insert,
        index
    );
    const customModifiers = getChapbookDefinitions(
        OChapbookSymbolKind.Modifier,
        index
    );

    for (const insertRef of insertReferences) {
        if (
            customInserts.find((i) => i.match.test(insertRef.contents)) ===
            undefined
        ) {
            diagnostics.push(
                ...insertRef.locations.map((loc) =>
                    Diagnostic.create(
                        loc.range,
                        `Insert ${insertRef.contents} not recognized`,
                        DiagnosticSeverity.Warning
                    )
                )
            );
        }
    }

    for (const modRef of modifierReferences) {
        if (
            customModifiers.find((i) => i.match.test(modRef.contents)) ===
            undefined
        ) {
            diagnostics.push(
                ...modRef.locations.map((loc) =>
                    Diagnostic.create(
                        loc.range,
                        `Modifier ${modRef.contents} not recognized`,
                        DiagnosticSeverity.Warning
                    )
                )
            );
        }
    }

    return diagnostics;
}
