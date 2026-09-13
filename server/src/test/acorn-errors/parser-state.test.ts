import { expect } from "chai";
import "mocha";
import * as acorn from "acorn";

import { ParserWithState } from "../../acorn-errors/parser-state";
import type { ErrorWithParserState } from "../../acorn-errors/parser-state";

/**
 * Parse `input` through `ParserWithState` and return the `SyntaxError` it
 * raises, or throw if the input actually parses.
 */
function parseAndCaptureError(input: string): ErrorWithParserState {
    try {
        ParserWithState.parse(input, {
            ecmaVersion: 2020,
            sourceType: "script",
        });
    } catch (err) {
        if (err instanceof SyntaxError) return err as ErrorWithParserState;
        throw err;
    }
    throw new Error(`expected "${input}" to fail to parse, but it parsed`);
}

/**
 * Message when the canary test (to detect Acorn internals changing on
 * upgrade) fails.
 */
const canaryFailureMessage =
    "Whoops, acorn's parser internals changed shape; see " +
    "`acorn-errors/parser-state.ts`";

describe("Acorn Parser With State", () => {
    it("captures the open-delimiter context stack for an unclosed call", () => {
        // No arrange

        const result = parseAndCaptureError("foo(");

        expect(result.parserState, canaryFailureMessage).to.not.be.undefined;
        expect(result.parserState?.context, canaryFailureMessage).to.deep.equal(
            ["{", "("],
        );
    });

    it("captures the failing token's type, value, and span for a bare identifier run", () => {
        // No arrange

        const result = parseAndCaptureError("a b c");

        expect(result.parserState, canaryFailureMessage).to.not.be.undefined;
        expect(result.parserState?.type.label, canaryFailureMessage).to.equal(
            "name",
        );
        expect(result.parserState?.value, canaryFailureMessage).to.equal("b");
        expect(result.parserState?.start, canaryFailureMessage).to.equal(2);
        expect(result.parserState?.end, canaryFailureMessage).to.equal(3);
    });

    it("captures the failing token's type and span for an empty object property value", () => {
        // No arrange

        const result = parseAndCaptureError("{a: }");

        expect(result.parserState, canaryFailureMessage).to.not.be.undefined;
        expect(result.parserState?.type.label, canaryFailureMessage).to.equal(
            "}",
        );
        expect(result.parserState?.start, canaryFailureMessage).to.equal(4);
        expect(result.parserState?.end, canaryFailureMessage).to.equal(5);
    });

    it("attaches no parserState when the internals are missing or misshapen", () => {
        // A parser whose `context` doesn't look like Acorn's TokContext stack
        // should degrade gracefully instead of throwing or attaching a
        // malformed `parserState`.
        class MisshapenParser extends ParserWithState {}
        const parser = new (
            MisshapenParser as unknown as new (
                options: acorn.Options,
                input: string,
            ) => MisshapenParser
        )({ ecmaVersion: 2020, sourceType: "script" }, "foo(");
        (parser as unknown as { context: unknown }).context = [
            "not",
            "a",
            "context",
        ];

        let result: ErrorWithParserState | undefined;
        try {
            parser.raise(0, "test message");
        } catch (err) {
            if (err instanceof SyntaxError)
                result = err as ErrorWithParserState;
        }

        expect(result, "raise should still throw a SyntaxError").to.not.be
            .undefined;
        expect(result?.parserState, canaryFailureMessage).to.be.undefined;
    });

    it("does not affect successful parses", () => {
        // No arrange

        expect(() =>
            ParserWithState.parse("const x = 1;", {
                ecmaVersion: 2020,
                sourceType: "script",
            }),
        ).to.not.throw();
    });
});
