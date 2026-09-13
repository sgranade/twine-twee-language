import { expect } from "chai";
import "mocha";

import { EcmaVersion } from "../../js-parser";
import { ParseFailure } from "../../acorn-errors/parse-failure";
import { ParserWithState } from "../../acorn-errors/parser-state";
import type { ErrorWithParserState } from "../../acorn-errors/parser-state";

/**
 * Build the parse failure context for `input` the way production does: parse
 * through `ParserWithState`, then hand the source and the thrown error to
 * `ParseFailure`.
 */
function failureFor(input: string): ParseFailure {
    try {
        ParserWithState.parse(input, {
            ecmaVersion: EcmaVersion,
            sourceType: "script",
        });
    } catch (err) {
        if (err instanceof SyntaxError) {
            return new ParseFailure(input, err as ErrorWithParserState);
        }
        throw err;
    }
    throw new Error(`expected "${input}" to fail to parse, but it parsed`);
}

/**
 * Build the parse failure context for `input` with no parser state, which is
 * what a purely lexical fault produces. Exercises the token-stream fallback.
 */
function failureWithoutParserState(input: string, pos: number): ParseFailure {
    const err: ErrorWithParserState = Object.assign(
        new SyntaxError("synthetic"),
        { pos },
    );
    return new ParseFailure(input, err);
}

describe("Acorn Parse Failures", () => {
    describe("Failing Token", () => {
        it("reports the failing token's label, value, and span", () => {
            // No arrange

            const result = failureFor("a b c").failingToken();

            expect(result).to.eql({
                label: "name",
                value: "b",
                start: 2,
                end: 3,
                text: "b",
            });
        });

        it("reports a punctuation token by its own label", () => {
            // No arrange

            const result = failureFor("{a: }").failingToken();

            expect(result).to.eql({
                label: "}",
                value: undefined,
                start: 4,
                end: 5,
                text: "}",
            });
        });

        it("reports a zero-width eof token when the text runs out", () => {
            // No arrange

            const result = failureFor("foo(").failingToken();

            expect(result).to.eql({
                label: "eof",
                value: undefined,
                start: 4,
                end: 4,
                text: "",
            });
        });

        it("falls back to the token stream when there's no parser state", () => {
            // No arrange

            const result = failureWithoutParserState("a b c", 2).failingToken();

            expect(result).to.eql({
                label: "name",
                value: "b",
                start: 2,
                end: 3,
                text: "b",
            });
        });

        it("reports nothing for a lexical fault, whose parser state is incoherent", () => {
            // No arrange

            const result = failureFor("foo('abc").failingToken();

            expect(result).to.be.undefined;
        });
    });

    describe("Token Before", () => {
        it("reports the token preceding the failure", () => {
            // No arrange

            const result = failureFor("a b c").tokenBefore();

            expect(result).to.eql({
                label: "name",
                value: "a",
                start: 0,
                end: 1,
                text: "a",
            });
        });

        it("reports the token before a failure at the end of the text", () => {
            // No arrange

            const result = failureFor("foo(").tokenBefore();

            expect(result).to.eql({
                label: "(",
                value: undefined,
                start: 3,
                end: 4,
                text: "(",
            });
        });

        it("reports nothing when the failure is at the first token", () => {
            // No arrange

            const result = failureFor("catch ").tokenBefore();

            expect(result).to.be.undefined;
        });

        it("uses the parser's last consumed token, not the failure position", () => {
            // `try{}` raises at position 0, the start of the whole statement,
            // so anything keyed off `pos` would find nothing before it.

            const result = failureFor("try{}").tokenBefore();

            expect(result).to.eql({
                label: "}",
                value: undefined,
                start: 4,
                end: 5,
                text: "}",
            });
        });
    });

    describe("Unclosed Delimiter", () => {
        it("reports an unclosed paren", () => {
            // No arrange

            const result = failureFor("foo(").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("reports an unclosed bracket, which Acorn's context stack doesn't track", () => {
            // No arrange
            const result = failureFor("[1,2").unclosedDelimiter();

            expect(result).to.eql({
                open: "[",
                close: "]",
                start: 0,
                end: 1,
            });
        });

        it("reports an unclosed brace", () => {
            // No arrange

            const result = failureFor("if(a){").unclosedDelimiter();

            expect(result).to.eql({
                open: "{",
                close: "}",
                start: 5,
                end: 6,
            });
        });

        it("reports the innermost of several open delimiters", () => {
            // No arrange

            const result = failureFor("x = {a: [1,").unclosedDelimiter();

            expect(result).to.eql({
                open: "[",
                close: "]",
                start: 8,
                end: 9,
            });
        });

        it("reports the open delimiter of a mismatched close", () => {
            // No arrange

            const result = failureFor("(]").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 0,
                end: 1,
            });
        });

        it("ignores delimiters inside comments", () => {
            // No arrange

            const result = failureFor("foo( /* ) */").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("ignores delimiters inside strings", () => {
            // No arrange

            const result = failureFor("foo('(', ')'").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("reports nothing when every delimiter is closed", () => {
            // No arrange

            const result = failureFor("a b c").unclosedDelimiter();

            expect(result).to.be.undefined;
        });

        it("reports nothing when the parser has already closed the delimiter", () => {
            // `{a: }` fails *at* the closing brace, so the brace is matched.
            // Only a scan that ignores the parser's own view would call it
            // unclosed

            const result = failureFor("{a: }").unclosedDelimiter();

            expect(result).to.be.undefined;
        });

        it("still finds an outer unclosed delimiter past a closed inner one", () => {
            // No arrange

            const result = failureFor("[1, {a: }").unclosedDelimiter();

            expect(result).to.eql({
                open: "[",
                close: "]",
                start: 0,
                end: 1,
            });
        });

        it("skips a closed inner delimiter that the parser tracks", () => {
            // Both `(` and `{` are on the token scan's stack, but the parser
            // has already matched the `{`. Only `(` is really open.

            const result = failureFor("f({a: }").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 1,
                end: 2,
            });
        });

        it("ignores delimiters after the failure position", () => {
            // No arrange

            const result = failureFor("a b (c").unclosedDelimiter();

            expect(result).to.be.undefined;
        });

        it("falls back to the token stream when there's no parser state", () => {
            // No arrange

            const result = failureWithoutParserState(
                "foo(",
                4,
            ).unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("reports the open call paren around an unterminated template", () => {
            // No arrange

            const result = failureFor("foo(`abc").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("reports the open call paren around an unterminated template substitution", () => {
            // No arrange

            const result = failureFor("foo(`ab${").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("reports the open call paren around an unterminated string", () => {
            // No arrange

            const result = failureFor("foo('abc").unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });

        it("retains the tokens produced before a lexical fault", () => {
            // No arrange

            const result = failureWithoutParserState(
                "foo( 'abc",
                5,
            ).unclosedDelimiter();

            expect(result).to.eql({
                open: "(",
                close: ")",
                start: 3,
                end: 4,
            });
        });
    });

    describe("Is At EOF", () => {
        it("is true when the text ran out", () => {
            // No arrange

            const result = failureFor("foo(").isAtEof();

            expect(result).to.be.true;
        });

        it("is false when the failure is at a real token", () => {
            // No arrange

            const result = failureFor("a b c").isAtEof();

            expect(result).to.be.false;
        });

        it("falls back to the failure position when there's no parser state", () => {
            expect(failureWithoutParserState("foo(", 4).isAtEof()).to.be.true;
            expect(failureWithoutParserState("a b c", 2).isAtEof()).to.be.false;
        });
    });

    describe("Token Before Matched Operator", () => {
        it("reports the token before the opener of a group the failure follows", () => {
            // No arrange

            const result =
                failureFor("try {} catch (e)").tokenBeforeMatchedOpener();

            expect(result).to.eql({
                label: "catch",
                value: "catch",
                start: 7,
                end: 12,
                text: "catch",
            });
        });

        it("looks past the group's contents", () => {
            // No arrange

            const result = failureFor(
                "try {} catch ({message, stack})",
            ).tokenBeforeMatchedOpener();

            expect(result?.text).to.equal("catch");
        });

        it("reports nothing when the failure doesn't follow a close", () => {
            expect(failureFor("foo(").tokenBeforeMatchedOpener()).to.be
                .undefined;
        });

        it("reports nothing when the group opens the text", () => {
            expect(failureFor("(a) b c").tokenBeforeMatchedOpener()).to.be
                .undefined;
        });
    });

    describe("Mismatched Closer", () => {
        it("reports a close that doesn't match the delimiter it closes", () => {
            // No arrange

            const result = failureFor("let x = (]").mismatchedCloser();

            expect(result).to.eql({
                open: { open: "(", close: ")", start: 8, end: 9 },
                closer: {
                    label: "]",
                    value: undefined,
                    start: 9,
                    end: 10,
                    text: "]",
                },
            });
        });

        it("reports nothing when the close matches", () => {
            expect(failureFor("{a: }").mismatchedCloser()).to.be.undefined;
        });

        it("reports nothing when the close matches the innermost delimiter, even with an outer one still open", () => {
            // The `}` closes the `{`; the `(` is unclosed, but that's the
            // unclosed-delimiter case, not a mismatch.
            expect(failureFor("let x = (1, {a: }").mismatchedCloser()).to.be
                .undefined;
        });

        it("reports nothing when nothing is open to close", () => {
            expect(failureFor("x = )").mismatchedCloser()).to.be.undefined;
        });

        it("reports nothing when the failure isn't at a closing delimiter", () => {
            expect(failureFor("foo(").mismatchedCloser()).to.be.undefined;
        });

        it("falls back to the token stream when there's no parser state", () => {
            // No arrange

            const result = failureWithoutParserState(
                "let x = (]",
                9,
            ).mismatchedCloser();

            expect(result?.open).to.eql({
                open: "(",
                close: ")",
                start: 8,
                end: 9,
            });
        });
    });

    describe("Message", () => {
        it("is Acorn's message without its trailing position", () => {
            expect(failureFor("a b c").message).to.equal("Unexpected token");
        });

        it("keeps parenthesized text that isn't a position", () => {
            expect(failureFor("let x = 'abc").message).to.equal(
                "Unterminated string constant",
            );
        });
    });
});
