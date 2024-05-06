import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "./index";
import { jsonLanguageService } from "./parser";
import { normalizeUri } from "./utilities";

/**
 * Validate a text file and generate diagnostics against it.
 *
 * @param textDocument Document to validate and generate diagnostics against
 * @param projectIndex Index of the ChoiceScript project
 * @param validationSettings Current validation settings
 * @param fsProvider File system provider
 * @returns List of diagnostic messages.
 */
export async function generateDiagnostics(
    textDocument: TextDocument,
    projectIndex: ProjectIndex
): Promise<Diagnostic[]> {
    const uri = normalizeUri(textDocument.uri);
    // Start with parse errors
    const diagnostics: Diagnostic[] = [...projectIndex.getParseErrors(uri)];

    // Add diagnostics from embedded documents
    const embeddedJSONDocuments = projectIndex.getEmbeddedJSONDocuments(uri);
    if (embeddedJSONDocuments !== undefined) {
        for (const doc of embeddedJSONDocuments) {
            const newDiagnostics = await jsonLanguageService.doValidation(
                doc.document,
                doc.jsonDocument,
                undefined
            );
            diagnostics.push(
                ...newDiagnostics.map((d) => {
                    d.range.start.line += doc.position.line;
                    d.range.end.line += doc.position.line;
                    return d;
                })
            );
        }
    }

    return diagnostics;
}
