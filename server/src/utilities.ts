import * as URI from "urijs";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Return contents of an iterable as pairs.
 *
 * @param itr Iterable.
 * @yields Contents of the iterable as pairs.
 */
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
 * Scan a document's text to find the end of the current line.
 *
 * @param document Document text to scan.
 * @param startIndex Index at which to begin scan.
 * @returns Index corresponding to one past the line's end, including any \r\n
 */
export function nextLineIndex(document: string, startIndex: number): number {
    let lineEnd: number;
    const lineEndPattern = /\r?\n|$/g;
    lineEndPattern.lastIndex = startIndex;
    const m = lineEndPattern.exec(document);
    if (m) {
        lineEnd = m.index + m[0].length;
    } else {
        lineEnd = document.length - 1;
    }

    return lineEnd;
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
