import * as URI from "urijs";
import {
    Diagnostic,
    DiagnosticSeverity,
    Position,
    Range,
} from "vscode-languageserver";
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

const paddingAndTextPattern = /^(\s*)(.*?)(\s*)$/;

/**
 * Remove padding from a string and capture how many pad characters were removed.
 *
 * @param s String to remove leading padding from.
 * @returns Tuple of the un-padded string and the lengths of removed padding on left nd right.
 */
export function removeAndCountPadding(s: string): [string, number, number] {
    const m = paddingAndTextPattern.exec(s);
    if (m === null) {
        return ["", 0, 0];
    }
    return [m[2], m[1].length, m[3].length];
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
 * Convert a position in an embedded document to one in its containing document.
 *
 * @param embeddedDocument The embedded document.
 * @param embeddedPosition Position within the embedded document.
 * @param document Document that contains the embedded document.
 * @param embeddedDocumentOffset Offset of the embedded document in the containing document.
 * @returns Position relative to the containing document.
 */
export function containingPosition(
    embeddedDocument: TextDocument,
    embeddedPosition: Position,
    document: TextDocument,
    embeddedDocumentOffset: number
): Position {
    return document.positionAt(
        embeddedDocument.offsetAt(embeddedPosition) + embeddedDocumentOffset
    );
}

/**
 * Convert a position in an embedded document to one in its containing document.
 *
 * @param embeddedDocument The embedded document.
 * @param embeddedRange Range within the embedded document.
 * @param document Document that contains the embedded document.
 * @param embeddedDocumentOffset Offset of the embedded document in the containing document.
 * @returns Position relative to the containing document.
 */
export function containingRange(
    embeddedDocument: TextDocument,
    embeddedRange: Range,
    document: TextDocument,
    embeddedDocumentOffset: number
): Range {
    return Range.create(
        containingPosition(
            embeddedDocument,
            embeddedRange.start,
            document,
            embeddedDocumentOffset
        ),
        containingPosition(
            embeddedDocument,
            embeddedRange.end,
            document,
            embeddedDocumentOffset
        )
    );
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
