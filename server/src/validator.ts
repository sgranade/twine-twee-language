import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "./index";
import { jsonLanguageService } from "./parser";
import { containingRange, normalizeUri } from "./utilities";

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
    const documentUri = normalizeUri(document.uri);
    // Start with parse errors
    const diagnostics: Diagnostic[] = [...index.getParseErrors(documentUri)];

    // Add diagnostics from embedded documents
    for (const {
        document: embeddedDocument,
        jsonDocument,
        position: embeddedPosition,
    } of index.getEmbeddedJSONDocuments(documentUri) || []) {
        const embeddedDocumentOffset = document.offsetAt(embeddedPosition);

        const newDiagnostics = await jsonLanguageService.doValidation(
            embeddedDocument,
            jsonDocument,
            undefined
        );
        for (const diagnostic of newDiagnostics) {
            diagnostic.range = containingRange(
                embeddedDocument,
                diagnostic.range,
                document,
                embeddedDocumentOffset
            );
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}
