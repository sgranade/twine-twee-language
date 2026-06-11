const endOfUnterminatedStringRegex = /(\\?)(?:\r?\n|$)/g;

/**
 * Extract an unterminated JavaScript string.
 *
 * @param document Document containing the unterminated string.
 * @param startIndex Index where the unterminated string begins.
 * @returns The unterminated string.
 */
function extractUnterminatedString(
    document: string,
    startIndex: number,
): string {
    let lineEnd = document.length - 1; // Default to the end of the excerpt
    let m: RegExpExecArray | null;

    endOfUnterminatedStringRegex.lastIndex = startIndex;
    do {
        m = endOfUnterminatedStringRegex.exec(document);
        // Go to the end of the line (if there's no line continuation char)
        if (m && m[1] !== "\\") {
            lineEnd = endOfUnterminatedStringRegex.lastIndex;
            break;
        }
    } while (m);

    return document.slice(startIndex, lineEnd);
}

/**
 * Find an unmatched delimiter in text.
 */
function findUnmatchedDelimiter(
    text: string,
): { open: string; close: string; contents: string; pos: number } | undefined {
    // Stack of opening delimiter pairs and where they occur
    const stack: [string, number][] = [];

    const pairs: Record<string, string> = {
        "(": ")",
        "[": "]",
        "{": "}",
    };

    const closing = new Set(Object.values(pairs));

    let inString: string | undefined;
    let escaped = false;
    let ndx = 0;

    for (const ch of text) {
        // Ignore escaped characters
        if (escaped) {
            escaped = false;
            continue;
        }

        if (ch === "\\") {
            escaped = true;
            continue;
        }

        // Ignore delimiters inside strings
        if (inString) {
            if (ch === inString) {
                inString = undefined;
            }
            continue;
        }

        if (ch === "'" || ch === '"' || ch === "`") {
            inString = ch;
            continue;
        }

        if (pairs[ch]) {
            stack.push([ch, ndx]);
        } else if (closing.has(ch)) {
            const last = stack.pop();

            if (!last || pairs[last[0]] !== ch) {
                return undefined;
            }
        }

        ndx++;
    }

    const unclosed = stack.pop();

    if (!unclosed) {
        return undefined;
    }

    const [openPair, openNdx] = unclosed;

    return {
        open: openPair,
        close: pairs[openPair],
        contents: openPair,
        pos: openNdx,
    };
}

/**
 * Regex to match an identifier that ends in a period or question mark + period.
 *
 * Javascript identifier regex uses unicode property escapes; see
 * https://github.com/tc39/proposal-regexp-unicode-property-escapes#other-examples
 */
const incompletePropertyOrOptionalChainingOperatorRegex =
    /((?:[$_\p{ID_Start}])(?:[$\u200C\u200D\p{ID_Continue}])*)(\??)\.\s*$/du;
/**
 * Regex to match an operator in an incomplete expression.
 */
const incompleteExpressionRegex = /([+\-*/%=&|^!<>?])\s*$/d;
/**
 * Regex to match a possible incomplete proprety definition (foo: ).
 */
const incompletePropertyDefinitionRegex =
    /((?:[$_\p{ID_Start}])(?:[$\u200C\u200D\p{ID_Continue}])*\s*):\s*$/du;
const incompleteControlRegex = /\b(if|for|while|switch)(\s*)$/d;
const incompleteCatchRegex = /\b(catch)(\s*)$/d;

/**
 * Improve Acorn's not-that-great error messages.
 *
 * @param text Text containing the error.
 * @param err Error as reported by Acorn.
 * @returns Updated diagnostic.
 */
export function improveAcornErrorMessage(
    text: string,
    err: SyntaxError & {
        pos?: number;
        loc?: {
            line: number;
            column: number;
        };
    },
): {
    contents: string;
    at: number;
    message: string;
} {
    let pos = err.pos ?? 0;
    const originalMessage = err.message;

    // Get rid of Acorn's position information "(line, char)"
    const improvedError = {
        contents: "",
        at: pos,
        message: originalMessage.replace(/\s*\(.*?\)\s*$/, ""),
    };

    if (
        originalMessage.startsWith("Unterminated string constant") ||
        originalMessage.startsWith("Unterminated template")
    ) {
        improvedError.contents = extractUnterminatedString(text, pos);
        return improvedError;
    }

    // The only other messages we tweak are for generic messages
    if (
        !(
            originalMessage.startsWith("Unexpected token") ||
            originalMessage.startsWith("Unexpected character") ||
            originalMessage.includes("Unexpected token")
        )
    )
        return improvedError;

    // Unmatched delimiters
    const unmatched = findUnmatchedDelimiter(text);

    if (unmatched) {
        improvedError.contents = unmatched.contents;
        improvedError.at = unmatched.pos;
        improvedError.message = `Opening '${unmatched.open}' is missing a matching '${unmatched.close}'`;
        return improvedError;
    }

    const context = text.slice(0, pos);

    // Find the final non-blank line before the error
    const lines = [...context.matchAll(/(?<=^|\n).*?(?=\r?\n|$)/dg)];
    let ndx = lines.length - 1;
    while (/^\s*$/.test(lines[ndx][0]) && ndx > 0) {
        ndx--;
    }
    const line = lines[ndx][0];
    const lineNdx = lines[ndx].indices?.at(0)?.at(0) ?? 0;

    // Missing a property, method, or call? (`foo.` or `foo?.`)
    let m = incompletePropertyOrOptionalChainingOperatorRegex.exec(line);
    if (m) {
        improvedError.at =
            (m.indices?.at(0)?.at(0) ?? 0) + m[1].length + lineNdx;
        improvedError.contents = m[2] + ".";
        if (m[2]) {
            improvedError.message =
                "Expected property, method, or call after optional chaining operator";
        } else {
            improvedError.message =
                "Expected property or method name after '.'";
        }
        return improvedError;
    }

    // Incomplete expression? (`foo +`)
    m = incompleteExpressionRegex.exec(line);
    if (m) {
        improvedError.at = (m.indices?.at(0)?.at(0) ?? 0) + lineNdx;
        improvedError.contents = m[1];
        improvedError.message =
            "Unexpected token; expression appears incomplete after operator";
        return improvedError;
    }

    // Incomplete property definition? (`foo :`)
    m = incompletePropertyDefinitionRegex.exec(line);
    if (m) {
        improvedError.at =
            (m.indices?.at(0)?.at(0) ?? 0) + m[1].length + lineNdx;
        improvedError.contents = ":";
        improvedError.message = "Expected value after ':'";
        return improvedError;
    }

    // Incomplete control statement? (`if `)
    m = incompleteControlRegex.exec(line);
    if (m) {
        // Leave the original position alone but mark that character
        improvedError.contents = text.slice(pos, pos + 1);
        improvedError.message = "Unexpected token; expected '('";
        return improvedError;
    }

    // Incomplete catch statement? (`catch `)
    m = incompleteCatchRegex.exec(line);
    if (m) {
        // Leave the original position alone but mark that character
        improvedError.contents = text.slice(pos, pos + 1);
        improvedError.message = "Unexpected token; expected '{'";
        return improvedError;
    }

    return improvedError;
}
