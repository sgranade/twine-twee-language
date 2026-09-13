import * as acorn from "acorn";

import { EcmaVersion } from "../js-parser";
import type { ErrorWithParserState, ParserState } from "./parser-state";

/**
 * A token at or around a JS parse failure.
 *
 * This is like `acorn.Token` but doesn't directly use that interface so,
 * if Acorn changes, we can limit changes to this interface (and the rest
 * of this file).
 */
export interface FailureToken {
    /** Acorn's token-type label: `"name"`, `"num"`, `"eof"`, `"}"`, ... */
    label: string;
    /** The token's value (if any). */
    value: unknown;
    /** Start offset in the text being parsed. */
    start: number;
    /** End offset in the text being parsed. */
    end: number;
    /** The source text the token spans. Empty for `eof`. */
    text: string;
}

/**
 * An opening delimiter that was still open when the parse failed.
 */
export interface OpenDelimiter {
    /** The opening delimiter character. */
    open: string;
    /** The closing delimiter that would have matched it. */
    close: string;
    /** Start offset of the opening delimiter in the text being parsed. */
    start: number;
    /** End offset of the opening delimiter in the text being parsed. */
    end: number;
}

/**
 * A range of the text that was parsed.
 *
 * (Not a VS Code Range because I just need two numbers, thanks.)
 */
export interface Span {
    start: number;
    end: number;
}

/**
 * A closing delimiter that doesn't match the delimiter it closes.
 */
export interface MismatchedCloser {
    /** The delimiter the close was matched against. */
    open: OpenDelimiter;
    /** The offending closing token. */
    closer: FailureToken;
}

const closerFor: Record<string, string> = {
    "(": ")",
    "[": "]",
    "{": "}",
};

const openers = new Set(Object.keys(closerFor));
const closers = new Set(Object.values(closerFor));

/**
 * Delimiters that appear both in Acorn's `context` stack and in the token
 * stream, so that the two can be correlated.
 *
 * This is necessary because these delimiters (`(` and `{`) push a `TokContext`,
 * but `[` doesn't. Neither do emplate framer (`` ` ``, `${`).
 */
const contextTrackedDelimiters = new Set(["(", "{"]);

/**
 * Tokenize `text`, keeping whatever was produced before any lexical fault.
 *
 * @param text Text to tokenize.
 * @returns The tokens produced, in source order, excluding `eof`.
 */
function tokenize(text: string): acorn.Token[] {
    // Acorn's `getToken()` function throws on a character it can't tokenize,
    // but I want to keep the tokens up to that point as context for improving
    // error messages.
    const tokens: acorn.Token[] = [];

    try {
        const tokenizer = acorn.tokenizer(text, { ecmaVersion: EcmaVersion });
        // In theory we could tokenize until `eof` or an error, but just in
        // case Acorn ever changes how it works internally, let's make sure
        // we eventually end by setting a ceiling of the number of characters
        // in the string (since each token is at least one character, this is
        // guaranteed to get all of them).
        for (let i = 0; i <= text.length; ++i) {
            const token = tokenizer.getToken();
            if (token.type === acorn.tokTypes.eof) break;
            tokens.push(token);
        }
    } catch {
        // We'll ignore the lexical fault
    }

    return tokens;
}

/**
 * Information about a failed parse, including context.
 *
 * This is the corner of the rug where I sweep all of the bits that deal
 * with Acorn internals so, if they change, we only have to adjust this
 * part.
 */
export class ParseFailure {
    /** The text that failed to parse. */
    readonly text: string;
    /** The offset w/in `text` where Acorn reported the failure. */
    readonly pos: number;
    /**
     * Acorn's error message w/no trailing `(line:column)`.
     */
    readonly message: string;

    private readonly parserState: ParserState | undefined;
    private readonly raisedAt: number | undefined;
    private tokenCache: acorn.Token[] | undefined;

    /**
     * @param text Text that failed to parse.
     * @param err Error Acorn threw, optionally carrying parser state.
     */
    constructor(
        text: string,
        err: ErrorWithParserState & { pos?: number; raisedAt?: number },
    ) {
        this.text = text;
        this.pos = err.pos ?? 0;
        this.message = err.message.replace(/\s*\(.*?\)\s*$/, "");
        this.parserState = err.parserState;
        this.raisedAt = err.raisedAt;
    }

    /**
     * The token the parse failed at.
     *
     * A lexical fault -- an unterminated string or template -- raises from
     * inside the tokenizer, so the parser's own token fields describe the
     * *previous* token at the *current* position: a zero-width token that
     * isn't `eof`, and so isn't a token at all. That state is discarded here
     * rather than reported as a failing token.
     *
     * @returns The failing token, or `undefined` if the failure was at a
     * character that isn't part of any token.
     */
    failingToken(): FailureToken | undefined {
        // A lexical error (untermiated string or template) raises inside the
        // acorn tokenizer, so the parser's own token fields are for the
        // *previous* token at the the *current* position and thus are a
        // zero-width pseudo-token.
        if (this.parserState !== undefined) {
            const { type, value, start, end } = this.parserState;
            if (end > start || type.label === "eof") {
                return {
                    label: type.label,
                    value,
                    start,
                    end,
                    text: this.text.slice(start, end),
                };
            }
        }

        const token = this.tokens().find((t) => t.end > this.pos);
        if (token !== undefined) return this.toFailureToken(token);

        return this.isAtEof()
            ? {
                  label: "eof",
                  value: undefined,
                  start: this.text.length,
                  end: this.text.length,
                  text: "",
              }
            : undefined;
    }

    /**
     * The token immediately before the failure.
     *
     * @returns The preceding token, or `undefined` if the parse failed at the
     * first token.
     */
    tokenBefore(): FailureToken | undefined {
        // If the Acorn parser state is available, it has the last-consumed
        // token (`lastTokEnd`). That's more reliable than trying to find the
        // token before `pos`, as `pos` isn't guaranteed to be at a token
        // boundary when Acorn raises an error.
        const lastTokEnd = this.parserState?.lastTokEnd;
        if (lastTokEnd !== undefined) {
            const token = this.tokens().find((t) => t.end === lastTokEnd);
            return token === undefined ? undefined : this.toFailureToken(token);
        }

        const before = this.tokensBeforeFailure();
        const token = before[before.length - 1];
        return token === undefined ? undefined : this.toFailureToken(token);
    }

    /**
     * The innermost delimiter still open when the parse failed.
     *
     * Positions come from the token stream, since Acorn's `context` stack
     * carries labels but no offsets. The parser state, when present, decides
     * whether a delimiter is genuinely still open: Acorn updates its context
     * as it *reads* each token, so a delimiter it has already matched --
     * `{a: }`, which fails at the closing brace -- is gone from the context
     * even though the token scan, which stops short of the failure, still
     * shows it open. Correlation is by delimiter label, innermost first;
     * token-stack entries the parser no longer shows open are skipped.
     *
     * @returns The innermost open delimiter, or `undefined` if none is open.
     */
    unclosedDelimiter(): OpenDelimiter | undefined {
        // Get still-open delimeters before the problem from the token stack
        const stack = this.openDelimiterStack();
        if (this.parserState === undefined) {
            return stack[stack.length - 1];
        }

        // Get the innermost tracked-delimeter frame. Skip element [0]
        // b/c that's implicit context Acorn pushes and that won't have a
        // delimeter. We're gonna drop template frames, too, since they
        // don't have a counterpart in the stack: an unterminated template
        // in a call would hide the call's unclosed parens, f'rex.
        const openFrames = this.parserState.context
            .slice(1) // Get rid of the implicit context
            .filter((token) => contextTrackedDelimiters.has(token));
        const innermostFrame = openFrames[openFrames.length - 1];

        // We're gonna correlate open delimeters between the token stack
        // (tokens before the failure as re-parsed by us) and the frames
        // in the Acorn `context` captured by our `ParserState`. We have to
        // do this b/c the Acorn `context` stack has labels but not offsets,
        // but closed delimeters are removed from the `context` stack even
        // though it can still appear to be open in the token delimeter stack.
        for (let i = stack.length - 1; i >= 0; --i) {
            const delimiter = stack[i];
            // Skip ones that won't be in Acorn's context stack, like `[`
            if (!contextTrackedDelimiters.has(delimiter.open)) return delimiter;
            if (delimiter.open === innermostFrame) return delimiter;
            // The parser matched this token & removed it from the `context` stack
        }

        return undefined;
    }

    /**
     * Whether the parse failed because the text ran out.
     *
     * @returns True if the failure is at end of input.
     */
    isAtEof(): boolean {
        if (this.parserState !== undefined) {
            return this.parserState.type.label === "eof";
        }
        return this.pos >= this.text.length;
    }

    /**
     * The token immediately before the opening delimiter that the closed delimeter
     * following the failure had matched.
     * 
     * This lets a rule ask "hey what construct just ended?"

    * @returns The token before the matched opener, or `undefined` if the
     * failure doesn't follow a close, the close matched nothing, or the
     * opener is the first token in the text.
     */
    tokenBeforeMatchedOpener(): FailureToken | undefined {
        const closer = this.tokenBefore();
        if (closer === undefined || !closers.has(closer.label)) {
            return undefined;
        }

        const tokens = this.tokens();
        const openerIndices: number[] = [];
        for (let i = 0; i < tokens.length; i++) {
            const token = tokens[i];
            if (token.start >= closer.start) break; // Too far!

            const label = token.type.label;
            if (openers.has(label)) {
                openerIndices.push(i);
            } else if (closers.has(label)) {
                const top = openerIndices[openerIndices.length - 1];
                if (
                    top !== undefined &&
                    closerFor[tokens[top].type.label] === label
                ) {
                    openerIndices.pop();
                }
            }
        }

        const openerIndex = openerIndices[openerIndices.length - 1];
        if (
            openerIndex === undefined ||
            closerFor[tokens[openerIndex].type.label] !== closer.label ||
            openerIndex === 0
        ) {
            return undefined;
        }

        return this.toFailureToken(tokens[openerIndex - 1]);
    }

    /**
     * Get the mismatched close delimeter, assuming parsing failed at a closing
     * delimeter that doesn't match the one it would be closing.
     *
     * @returns The mismatched close and the delimiter it was measured
     * against, or `undefined` if the parse didn't fail on a close, or the
     * close matched, or nothing was open to close.
     */
    mismatchedCloser(): MismatchedCloser | undefined {
        // Compare the token scan's innermost open delimeter b/c, when a close
        // is read, the parser's already dropped the delimeter it matched from
        // its context. This deals with e.g. the case `let x = (1, {a: }`, where
        // `}` actually closes the inner braces but would otherwise be compared
        // to the outer `(`.
        const closer = this.failingToken();
        if (closer === undefined || !closers.has(closer.label)) {
            return undefined;
        }

        const stack = this.openDelimiterStack();
        const open = stack[stack.length - 1];
        if (open === undefined || open.close === closer.label) {
            return undefined;
        }

        return { open, closer };
    }

    /**
     * The span to underline when no rule matches the failure.
     *
     * @returns The span relative to the parsed text.
     */
    fallbackSpan(): Span {
        // Option one: A token at Acorn's reported position
        const token = this.tokenCoveringFailure();
        if (token !== undefined) {
            return { start: token.start, end: token.end };
        }

        // Option two: At end of the text
        if (this.isAtEof()) {
            return this.lastNonWhitespaceSpan();
        }

        // Option 3: `[pos, raisedAt]` if it's not empty and doesn't cross lines
        const raisedAtSpan = this.raisedAtSpan();
        if (raisedAtSpan !== undefined) return raisedAtSpan;

        // Option 4: The single character at the position
        if (this.pos < this.text.length && !/\s/.test(this.text[this.pos])) {
            return { start: this.pos, end: this.pos + 1 };
        }

        // Option 5: Stick with the zero-width span
        return { start: this.pos, end: this.pos };
    }

    /**
     * The token that Acorn's reported position falls inside.
     */
    private tokenCoveringFailure(): FailureToken | undefined {
        const covers = (start: number, end: number) =>
            start <= this.pos && end > this.pos;

        // Prefer the parser state's token if it contains the position
        const failing = this.failingToken();
        if (failing !== undefined && covers(failing.start, failing.end)) {
            return failing;
        }

        // If not, find our own parsed token that contains the position
        const token = this.tokens().find((t) => covers(t.start, t.end));
        return token === undefined ? undefined : this.toFailureToken(token);
    }

    /**
     * The last non-whitespace character in the text as a span, or a
     * zero-width span at the failure if the text is entirely whitespace.
     */
    private lastNonWhitespaceSpan(): Span {
        for (let i = this.text.length - 1; i >= 0; i--) {
            if (!/\s/.test(this.text[i])) return { start: i, end: i + 1 };
        }
        return { start: this.pos, end: this.pos };
    }

    /**
     * `[pos, raisedAt]`, or `undefined` if it's empty or spans a line break.
     *
     * We don't allow it to span a line break because that means Acorn kept
     * reading across the break. For instance, `x=1;\n\n\n\nreturn` raises
     * with `pos` 8 and `raisedAt` 14, which is mostly blank lines.
     */
    private raisedAtSpan(): Span | undefined {
        if (this.raisedAt === undefined) return undefined;

        const end = Math.min(this.raisedAt, this.text.length);
        if (end <= this.pos) return undefined;
        if (/[\r\n]/.test(this.text.slice(this.pos, end))) return undefined;

        return { start: this.pos, end };
    }

    /**
     * The text's token stream.
     */
    private tokens(): acorn.Token[] {
        // We lazy compute this and cache the results.
        if (this.tokenCache === undefined) {
            this.tokenCache = tokenize(this.text);
        }
        return this.tokenCache;
    }

    /**
     * The tokens before the failure.
     */
    private tokensBeforeFailure(): acorn.Token[] {
        // We can't trust tokens at or after the failure position, as Acorn
        // stopped parsing there, and the tokenizer can go wrong past that point.
        return this.tokens().filter((t) => t.start < this.pos);
    }

    /**
     * The delimiters open at the failure, outermost first, taken from the token
     * stream.
     */
    private openDelimiterStack(): OpenDelimiter[] {
        const stack: OpenDelimiter[] = [];

        for (const token of this.tokensBeforeFailure()) {
            const label = token.type.label;
            if (openers.has(label)) {
                stack.push({
                    open: label,
                    close: closerFor[label],
                    start: token.start,
                    end: token.end,
                });
            } else if (closers.has(label)) {
                // If the most recent opener doesn't match, leave it on
                // the stack so we can recognize it as a potential
                // mismatched delimeter later.
                const top = stack[stack.length - 1];
                if (top !== undefined && top.close === label) stack.pop();
            }
        }

        return stack;
    }

    /**
     * Convert an `acorn.Token` to our `FailureToken`.
     *
     * @param token Token to convert.
     * @returns Failure token.
     */
    private toFailureToken(token: acorn.Token): FailureToken {
        return {
            label: token.type.label,
            // Acorn's tokens carry a `value` at runtime, but its `Token`
            // declaration omits it
            value: (token as acorn.Token & { value?: unknown }).value,
            start: token.start,
            end: token.end,
            text: this.text.slice(token.start, token.end),
        };
    }
}
