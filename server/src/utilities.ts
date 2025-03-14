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
 * Compare two dotted version numbers such as "1.3.2".
 *
 * @param ver1 First version number.
 * @param ver2 Second version number.
 * @returns -1 if ver1 < ver2, 0 if ver1 = ver2, and 1 if ver1 > ver2
 */
export function versionCompare(ver1: string, ver2: string): number {
    const ver1Parts = ver1.split(".").map((n) => parseInt(n, 10));
    const ver2Parts = ver2.split(".").map((n) => parseInt(n, 10));
    const minLength = Math.min(ver1Parts.length, ver2Parts.length);
    for (let i = 0; i < minLength; ++i) {
        if (Number.isNaN(ver1Parts[i])) return -1;
        if (Number.isNaN(ver2Parts[i])) return 1;
        if (ver1Parts[i] < ver2Parts[i]) return -1;
        if (ver1Parts[i] > ver2Parts[i]) return 1;
    }
    // If we reach here then the versions are equal as far as we've been able to compare
    if (ver1Parts.length < ver2Parts.length) return -1;
    if (ver1Parts.length > ver2Parts.length) return 1;
    return 0;
}

/** TYPE NARROWING HELPERS **/

/**
 * Check if an object has a given property.
 *
 * This function convinces Typescript to narrow the type so we can
 * get access to the property after checking for it.
 *
 * @param obj Object to check.
 * @param prop Property to check for.
 * @returns True if the object has the property.
 */
export function hasOwnProperty<T, K extends PropertyKey>(
    obj: T,
    prop: K
): obj is T & Record<K, unknown> {
    return Object.prototype.hasOwnProperty.call(obj, prop);
}

/** TEXT AND STRING MANIPULATION **/

const lineEndRegex = /\r?\n|$/g;

/**
 * Scan a document's text to find the end of the current line.
 *
 * @param document Document text to scan.
 * @param startIndex Index at which to begin scan.
 * @returns Index corresponding to one past the line's end, including any \r\n
 */
export function nextLineIndex(document: string, startIndex: number): number {
    let lineEnd: number;
    lineEndRegex.lastIndex = startIndex;
    const m = lineEndRegex.exec(document);
    if (m) {
        lineEnd = m.index + m[0].length;
    } else {
        lineEnd = document.length - 1;
    }

    return lineEnd;
}

/**
 * Replace all matching text with blank spaces.
 *
 * @param s String to erase matches from.
 * @param r RegExp to match. Must be a global regex.
 * @param c Optional callback that takes the regex match results.
 * @returns String with all matched text replaced by spaces.
 */
export function eraseMatches(
    s: string,
    r: RegExp,
    c?: (m: RegExpExecArray | null) => void
): string {
    // For speed, erase the matches by collecting substrings to join at the end
    const substrs: string[] = [];
    let ndx = 0;

    // Unroll these two for speed, since we call this a lot
    if (c !== undefined) {
        for (const m of s.matchAll(r)) {
            c(m);
            substrs.push(s.slice(ndx, m.index), " ".repeat(m[0].length));
            ndx = m.index + m[0].length;
        }
    } else {
        for (const m of s.matchAll(r)) {
            substrs.push(s.slice(ndx, m.index), " ".repeat(m[0].length));
            ndx = m.index + m[0].length;
        }
    }
    substrs.push(s.slice(ndx));

    return substrs.join("");
}

const paddingAndTextRegex = /^(\s*)(.*?)(\s*)$/s;

/**
 * Remove padding from a string and capture how many pad characters were removed.
 *
 * @param s String to remove leading padding from.
 * @returns Tuple of the un-padded string and the lengths of removed padding on left and right.
 */
export function removeAndCountPadding(s: string): [string, number, number] {
    const m = paddingAndTextRegex.exec(s);
    if (m === null) {
        return ["", 0, 0];
    }
    return [m[2], m[1].length, m[3].length];
}

/**
 * Move a string and its index into a larger string to the first non-space character.
 *
 * For example, calling this function with ("  test", 7) would return ["test", 9].
 *
 * @param s String to remove leading padding from.
 * @param n Index into a larger string.
 * @returns Tuple of the un-padded string and the new index value.
 */
export function skipSpaces(s: string, n: number): [string, number] {
    const [sTrimmed, leftPad] = removeAndCountPadding(s);
    return [sTrimmed, n + leftPad];
}

const doubleQuoteSearch = /(?<!\\)"/g;
const singleQuoteSearch = /(?<!\\)'/g;
const bracketSearch = /[{}]/g;
const parensSearch = /[()]/g;

/**
 * Scan string to find a matching delimiter, skipping escaped delimiters.
 *
 * @param s String to scan.
 * @param openDelimiter Delimiter that opens the group.
 * @param closeDelimiter Delimiter that closes the group.
 * @param startIndex Index inside of text where the delimited contents begin (after the opening delimiter).
 * @returns String contained within the delimiters, not including the closing delimiter.
 */
export function extractToMatchingDelimiter(
    s: string,
    openDelimiter: string,
    closeDelimiter: string,
    startIndex = 0
): string | undefined {
    let matchEnd: number | undefined = undefined;
    let delimiterCount = 0;
    let m: RegExpExecArray | null;
    let match: RegExp;

    if (closeDelimiter === "}") {
        match = bracketSearch;
    } else if (closeDelimiter === '"') {
        match = doubleQuoteSearch;
    } else if (closeDelimiter === "'") {
        match = singleQuoteSearch;
    } else if (closeDelimiter === ")") {
        match = parensSearch;
    } else if (openDelimiter === closeDelimiter) {
        match = RegExp(`(?<!\\\\)\\${openDelimiter}`, "g");
    } else {
        match = RegExp(
            `(?<!\\\\)(\\${openDelimiter}|\\${closeDelimiter})`,
            "g"
        );
    }

    match.lastIndex = startIndex;

    while ((m = match.exec(s))) {
        if (m[0] === closeDelimiter) {
            if (delimiterCount) delimiterCount--;
            else {
                matchEnd = m.index;
                break;
            }
        } else if (m[0] === openDelimiter) {
            delimiterCount++;
        }
    }
    if (matchEnd === undefined) {
        return undefined;
    }
    return s.slice(startIndex, matchEnd);
}

/** EMBEDDED DOCUMENTS **/

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
 * Convert a range in an embedded document to one in its containing document.
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

/** POSITION AND RANGE UTILITIES **/

/**
 * Compare two positions.
 * @param pos1 First position.
 * @param pos2 Second position.
 * @returns -1 if pos1 is before pos2, 0 if they're equal, 1 if pos1 is after pos2.
 */
export function comparePositions(pos1: Position, pos2: Position): number {
    if (pos1.line == pos2.line && pos1.character == pos2.character) {
        return 0;
    }
    return pos1.line > pos2.line ||
        (pos1.line == pos2.line && pos1.character > pos2.character)
        ? 1
        : -1;
}

/**
 * Determine if a position is inside a range.
 * @param position Position.
 * @param range Range.
 */
export function positionInRange(position: Position, range: Range): boolean {
    return (
        comparePositions(position, range.start) >= 0 &&
        comparePositions(position, range.end) <= 0
    );
}

/** OBJECT CREATION **/

/**
 * Generate a diagnostic message.
 *
 * Pass start and end locations as 0-based indexes into the document's text.
 *
 * @param severity Diagnostic severity
 * @param textDocument Document to which the diagnostic applies.
 * @param start Start location in the document of the diagnostic message.
 * @param end End location in the document of the diagnostic message.
 * @param message Diagnostic message.
 */
export function createDiagnostic(
    severity: DiagnosticSeverity,
    textDocument: TextDocument,
    start: number,
    end: number,
    message: string
): Diagnostic {
    return Diagnostic.create(
        Range.create(
            textDocument.positionAt(start),
            textDocument.positionAt(end)
        ),
        message,
        severity,
        undefined,
        "Twine"
    );
}

/**
 * Generate a diagnostic message for a given piece of text.
 *
 * Pass the text's location as a 0-based index into the document's text.
 *
 * @param severity Diagnostic severity
 * @param textDocument Document to which the diagnostic applies.
 * @param text Text to generate the diagnostic message about.
 * @param at Location in the document of the text.
 * @param message Diagnostic message.
 * @returns
 */
export function createDiagnosticFor(
    severity: DiagnosticSeverity,
    textDocument: TextDocument,
    text: string,
    at: number,
    message: string
): Diagnostic {
    return createDiagnostic(
        severity,
        textDocument,
        at,
        at + text.length,
        message
    );
}
