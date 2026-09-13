import type { FailureToken, ParseFailure } from "./parse-failure";

/**
 * The kind of mistake a rule recognizes.
 *
 * This isn't a `DiagnosticCode` b/c I don't want users to silence individual
 * syntax errors, but does exist so a rule can give a quick fix.
 */
export type ImprovedMessageKind =
    | "unterminated-string"
    | "unclosed-delimiter"
    | "mismatched-delimiter"
    | "missing-property"
    | "incomplete-expression"
    | "missing-property-value"
    | "missing-control-parens"
    | "missing-catch-block"
    | "unknown";

/**
 * A diagnostic a rule proposes relative to the parsed text.
 */
export interface ImprovedMessage {
    kind: ImprovedMessageKind;
    /** Start of the text the diagnostic refers to. */
    start: number;
    /** End of the text the diagnostic refers to. */
    end: number;
    message: string;
}

/**
 * A rule that recognizes a mistake in a parse failure and returns an
 * improved error message.
 *
 * Rules only use context from `ParseFailure`, not raw source text
 * or Acorn tokens, fyi.
 */
export type Rule = (failure: ParseFailure) => ImprovedMessage | undefined;

const endOfUnterminatedStringRegex = /(\\?)(?:\r?\n|$)/g;

/**
 * Extract an unterminated JavaScript string or template.
 *
 * @param text Text containing the unterminated string.
 * @param startIndex Index where the unterminated string begins.
 * @returns The unterminated string.
 */
function extractUnterminatedString(text: string, startIndex: number): string {
    let lineEnd = text.length - 1; // Default to the end of the text
    let m: RegExpExecArray | null;

    endOfUnterminatedStringRegex.lastIndex = startIndex;
    do {
        m = endOfUnterminatedStringRegex.exec(text);
        // Go to the end of the line (if there's no line continuation char)
        if (m && m[1] !== "\\") {
            lineEnd = endOfUnterminatedStringRegex.lastIndex;
            break;
        }
    } while (m);

    return text.slice(startIndex, lineEnd);
}

/**
 * A string or template literal that isn't terminated.
 */
export const unterminatedStringRule: Rule = (failure) => {
    // We have to have this as a special case because it's a lexical failure,
    // which means Acorn raises it from within the tokenizer, which in turn
    // means there's no parser state to use and no token stream past the
    // opening quote.
    if (
        !failure.message.startsWith("Unterminated string constant") &&
        !failure.message.startsWith("Unterminated template")
    ) {
        return undefined;
    }

    const contents = extractUnterminatedString(failure.text, failure.pos);
    return {
        kind: "unterminated-string",
        start: failure.pos,
        end: failure.pos + contents.length,
        message: failure.message,
    };
};

/**
 * An opening delimiter that never gets closed.
 */
export const unclosedDelimiterRule: Rule = (failure) => {
    const open = failure.unclosedDelimiter();
    if (open === undefined) return undefined;

    return {
        kind: "unclosed-delimiter",
        start: open.start,
        end: open.end,
        message: `Opening '${open.open}' is missing a matching '${open.close}'`,
    };
};

/**
 * A closing delimiter that doesn't match the one it closes: `(]`.
 */
const mismatchedDelimiterRule: Rule = (failure) => {
    const mismatch = failure.mismatchedCloser();
    if (mismatch === undefined) return undefined;

    const { open, closer } = mismatch;
    return {
        kind: "mismatched-delimiter",
        start: closer.start,
        end: closer.end,
        message: `Opening '${open.open}' is closed by '${closer.text}' instead of '${open.close}'`,
    };
};

/**
 * A property access with no property after it: `foo.` or `foo?.`.
 */
const missingPropertyRule: Rule = (failure) => {
    const before = failure.tokenBefore();
    if (before === undefined) return undefined;

    // Acorn reads `?.` as one token, except when the text ends right after it,
    // when it splits into `?` and `.`, and the `.` is what the parse fails on.
    const failing = failure.failingToken();
    if (
        failing?.label === "." &&
        before.label === "?" &&
        before.end === failing.start
    ) {
        return optionalChainMessage(before.start, failing.end);
    }

    if (before.label === "?.") {
        return optionalChainMessage(before.start, before.end);
    }

    if (before.label === ".") {
        return {
            kind: "missing-property",
            start: before.start,
            end: before.end,
            message: "Missing property or method name after '.'",
        };
    }

    return undefined;
};

function optionalChainMessage(start: number, end: number): ImprovedMessage {
    return {
        kind: "missing-property",
        start,
        end,
        message: "Missing property, method, or call after '?.'",
    };
}

/**
 * A property with a name and a colon but no value: `{foo: }`.
 */
const missingPropertyValueRule: Rule = (failure) => {
    const before = failure.tokenBefore();
    if (before?.label !== ":") return undefined;

    return {
        kind: "missing-property-value",
        start: before.start,
        end: before.end,
        message: "Missing value after ':'",
    };
};

/**
 * Token labels for the operators that can't end an expression.
 *
 * Acorn's labels aren't the operator's source text, b/c one label covers a
 * family (`"+/-"`, `"==/!=/===/!=="`), so the message uses the token's text
 * and the label is only used to recognize it. This skips `.`, `?.`, and `:`
 * since they have rules of their own.
 */
const incompleteExpressionLabels = new Set([
    "+/-",
    "*",
    "/",
    "%",
    "**",
    "==/!=/===/!==",
    "</>/<=/>=",
    "<</>>/>>>",
    "&&",
    "||",
    "??",
    "|",
    "^",
    "&",
    "=",
    "_=",
    "!/~",
    "?",
    "=>",
    "in",
    "instanceof",
]);

/**
 * An expression that stops after an operator: `foo +`.
 */
const incompleteExpressionRule: Rule = (failure) => {
    const before = failure.tokenBefore();
    if (before === undefined || !incompleteExpressionLabels.has(before.label)) {
        return undefined;
    }

    return {
        kind: "incomplete-expression",
        start: before.start,
        end: before.end,
        message: `Incomplete expression after the operator '${before.text}'`,
    };
};

const controlKeywords = new Set(["if", "for", "while", "switch"]);

/**
 * A control statement whose condition parentheses are missing: `if x`.
 */
const missingControlParensRule: Rule = (failure) => {
    const before = failure.tokenBefore();
    if (before === undefined || !controlKeywords.has(before.label)) {
        return undefined;
    }

    return {
        kind: "missing-control-parens",
        start: before.start,
        end: before.end,
        message: `Missing '(' after '${before.text}'`,
    };
};

/**
 * A `catch` with no block after it, w/ or w/o a binding: `catch` or
 * `catch (e)`.
 */
const missingCatchBlockRule: Rule = (failure) => {
    const before = failure.tokenBefore();
    if (before?.label === "catch") {
        return missingCatchBlockMessage(before);
    }

    const beforeBinding = failure.tokenBeforeMatchedOpener();
    if (beforeBinding?.label === "catch") {
        return missingCatchBlockMessage(beforeBinding);
    }

    return undefined;
};

function missingCatchBlockMessage(keyword: FailureToken): ImprovedMessage {
    return {
        kind: "missing-catch-block",
        start: keyword.start,
        end: keyword.end,
        message: "Missing '{' after 'catch'",
    };
}

/**
 * Every rule in priority order.
 *
 * Well, not every rule: `unterminatedStringRule` isn't in here b/c it's
 * special cased before we get to arbitrating what rule wins.
 *
 * `unterminatedStringRule` is not in this list; it's special-cased ahead of
 * arbitration entirely.
 */
export const rules: readonly Rule[] = [
    mismatchedDelimiterRule,
    unclosedDelimiterRule,
    missingPropertyRule,
    missingPropertyValueRule,
    missingControlParensRule,
    missingCatchBlockRule,
    incompleteExpressionRule,
];

/**
 * If no rule matches, fall back to the original Acorn message but with an
 * improved span.
 *
 * @param failure The parse failure context.
 * @param message The message to report.
 * @returns The improved message.
 */
export function fallbackMessage(
    failure: ParseFailure,
    message: string,
): ImprovedMessage {
    return {
        kind: "unknown",
        ...failure.fallbackSpan(),
        message,
    };
}

/**
 * What to report when no rule matched.
 *
 * @param failure The parse failure context.
 * @param token The failing token, if there is one.
 * @returns The fallback message.
 */
export function unknownErrorMessage(
    failure: ParseFailure,
    token: FailureToken | undefined,
): ImprovedMessage {
    let message = failure.message;

    // Acorn's generic `Unexpected token` has no further information, which isn't
    // helpful. Append the actual unexpected token to the message.
    if (message === "Unexpected token") {
        if (token?.label === "eof") {
            message = "Unexpected end of input";
        } else if (token !== undefined && token.text !== "") {
            message = `Unexpected token '${token.text}'`;
        }
    }

    return fallbackMessage(failure, message);
}
