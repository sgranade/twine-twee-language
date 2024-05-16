import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { doValidation } from "./embedded-languages";
import { ProjectIndex } from "./index";
import { containingRange } from "./utilities";

/**
 * Validate a document's references to Twine passages.
 *
 * @param document Document to validate.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
function validatePassageReferences(
    document: TextDocument,
    index: ProjectIndex
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const references = index.getPassageReferences(document.uri);
    const names = index.getPassageNames();
    for (const [name, ranges] of Object.entries(references || {})) {
        if (!names.includes(name)) {
            for (const range of ranges) {
                diagnostics.push(
                    Diagnostic.create(
                        range,
                        `Cannot find passage '${name}'`,
                        DiagnosticSeverity.Error,
                        undefined,
                        "Twine"
                    )
                );
            }
        }
    }

    return diagnostics;
}

/**
 * Validate a text file and generate diagnostics against it.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
export async function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex
): Promise<Diagnostic[]> {
    // Start with parse errors
    const diagnostics: Diagnostic[] = [...index.getParseErrors(document.uri)];

    // Add diagnostics from embedded documents
    for (const embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        const newDiagnostics = await doValidation(embeddedDocument);
        for (const diagnostic of newDiagnostics) {
            diagnostic.range = containingRange(
                embeddedDocument.document,
                diagnostic.range,
                document,
                embeddedDocument.offset
            );
            diagnostics.push(diagnostic);
        }
    }

    // Validate passage references
    diagnostics.push(...validatePassageReferences(document, index));

    return diagnostics;
}
