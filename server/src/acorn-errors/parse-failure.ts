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
 * A line of source text, with the offset at which it begins.
 */
export interface SourceLine {
    text: string;
    start: number;
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

    private readonly parserState: ParserState | undefined;
    private tokenCache: acorn.Token[] | undefined;

    /**
     * @param text Text that failed to parse.
     * @param err Error Acorn threw, optionally carrying parser state.
     */
    constructor(text: string, err: ErrorWithParserState & { pos?: number }) {
        this.text = text;
        this.pos = err.pos ?? 0;
        this.parserState = err.parserState;
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
     * The source text preceding the failure.
     *
     * @returns Everything in `text` before the failure position.
     */
    textBefore(): string {
        return this.text.slice(0, this.pos);
    }

    /**
     * The last line with content before the failure, truncated at the failure.
     *
     * @returns The line's text and the offset at which it begins.
     */
    lineBefore(): SourceLine {
        const before = this.textBefore();
        const lines = [...before.matchAll(/(?<=^|\n).*?(?=\r?\n|$)/dg)];
        if (lines.length === 0) return { text: "", start: 0 };

        let ndx = lines.length - 1;
        while (ndx > 0 && /^\s*$/.test(lines[ndx][0])) {
            ndx--;
        }

        return {
            text: lines[ndx][0],
            start: lines[ndx].indices?.at(0)?.at(0) ?? 0,
        };
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
