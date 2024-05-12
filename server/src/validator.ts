import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { doValidation } from "./embedded-languages";
import { ProjectIndex } from "./index";
import { containingRange } from "./utilities";

/**
 * Validate a text file and generate diagnostics against it.
 *
 * @param document Document to validate and generate diagnostics against
 * @param index Index of the ChoiceScript project
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

    return diagnostics;
}
