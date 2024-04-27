import {
    Location,
    Diagnostic,
    DiagnosticSeverity,
    DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "./index";
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

    // TODO future validation goes here

    return diagnostics;
}
