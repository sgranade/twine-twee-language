import * as URI from "urijs";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Return contents of an iterable as pairs.
 *
 * @param itr Iterable.
 * @yields Contents of the iterable as pairs.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function* pairwise<T>(itr: Iterable<T>) {
    let prevEntry;
    for (const item of itr) {
        if (prevEntry !== undefined) {
            yield [prevEntry, item];
        }
        prevEntry = item;
    }
}

/**
 * Normalize a URI.
 *
 * @param uriString URI to normalize.
 */
export function normalizeUri(uriString: string): string {
    const uri = new URI(uriString);
    return uri.normalize().toString();
}

/**
 * Generate a diagnostic message.
 *
 * Pass start and end locations as 0-based indexes into the document's text.
 *
 * @param severity Diagnostic severity
 * @param textDocument Document to which the diagnostic applies.
 * @param start Start location in the text of the diagnostic message.
 * @param end End location in the text of the diagnostic message.
 * @param message Diagnostic message.
 */
export function createDiagnostic(
    severity: DiagnosticSeverity,
    textDocument: TextDocument,
    start: number,
    end: number,
    message: string
): Diagnostic {
    const diagnostic: Diagnostic = {
        severity: severity,
        range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end),
        },
        message: message,
        source: "Twine",
    };

    return diagnostic;
}
