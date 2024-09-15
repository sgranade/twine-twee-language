import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { DiagnosticsOptions } from "../../server-options";
import {
    findEndOfPartialInsert,
    findStartOfModifierOrInsert,
    getChapbookDefinitions,
    tokenizeInsert,
    validateInsertContents,
} from "./chapbook-parser";
import { OChapbookSymbolKind } from "./types";

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
    const text = document.getText();

    // Check for variables that don't have a matching set statement in a vars section
    const varSetNamesWithDuplicates: string[] = [];
    for (const uri of index.getIndexedUris()) {
        varSetNamesWithDuplicates.push(
            ...(index
                .getReferences(uri, OChapbookSymbolKind.VariableSet)
                ?.map((ref) => ref.contents) || [])
        );
    }
    const varSetNames = new Set(varSetNamesWithDuplicates);
    for (const varRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.Variable
    ) || []) {
        if (!varSetNames.has(varRef.contents)) {
            const message = `Variable "${varRef.contents}" isn't set in any vars section. Make sure you've spelled it correctly.`;
            diagnostics.push(
                ...varRef.locations.map((loc) =>
                    Diagnostic.create(
                        loc.range,
                        message,
                        DiagnosticSeverity.Warning
                    )
                )
            );
        }
    }

    // Check for unrecognized custom inserts (if that option is set) and
    // any argument errors in recognized custom inserts
    const customInserts = getChapbookDefinitions(
        OChapbookSymbolKind.CustomInsert,
        index
    );
    for (const insertRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.CustomInsert
    ) || []) {
        const insert = customInserts.find((i) =>
            i.match.test(insertRef.contents)
        );
        if (insert !== undefined) {
            // We need to re-parse the custom insert and check for errors
            // if we have information about that custom insert's arguments
            if (
                insert.firstArgument === undefined &&
                insert.requiredProps === undefined &&
                insert.optionalProps === undefined
            )
                continue;

            for (const loc of insertRef.locations) {
                // Find the start of the insert
                const startNdx = findStartOfModifierOrInsert(
                    text,
                    document.offsetAt(loc.range.start)
                );
                if (startNdx === undefined) continue;

                // Extract the insert
                const endNdx = findEndOfPartialInsert(text, startNdx);
                if (endNdx === undefined) continue;
                const insertText = text.substring(startNdx, endNdx + 1);

                // Tokenize the insert and validate its arguments
                const insertTokens = tokenizeInsert(insertText, startNdx);
                diagnostics.push(
                    ...validateInsertContents(
                        insert,
                        insertTokens,
                        document,
                        index.getStoryData()?.storyFormat?.formatVersion
                    )
                );
            }
        } else if (diagnosticsOptions.warnings.unknownMacro) {
            diagnostics.push(
                ...insertRef.locations.map((loc) =>
                    Diagnostic.create(
                        loc.range,
                        `Insert "${insertRef.contents}" not recognized`,
                        DiagnosticSeverity.Warning
                    )
                )
            );
        }
    }

    const customModifiers = getChapbookDefinitions(
        OChapbookSymbolKind.CustomModifier,
        index
    );
    for (const modRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.CustomModifier
    ) || []) {
        const modifier = customModifiers.find((i) =>
            i.match.test(modRef.contents)
        );
        if (modifier !== undefined) {
            // TODO validate modifier arguments when we add that for custom modifiers
        } else if (diagnosticsOptions.warnings.unknownMacro) {
            diagnostics.push(
                ...modRef.locations.map((loc) =>
                    Diagnostic.create(
                        loc.range,
                        `Modifier "${modRef.contents}" not recognized`,
                        DiagnosticSeverity.Warning
                    )
                )
            );
        }
    }

    return diagnostics;
}
