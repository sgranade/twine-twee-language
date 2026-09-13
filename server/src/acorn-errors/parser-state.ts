import * as acorn from "acorn";

/**
 * Acorn parser state captured at the moment it raises a `SyntaxError`.
 *
 * See, the SyntaxError only gives a position, line/column, and string,
 * while the parser knows the actual token that it barfed on plus any
 * stack of open delimiters.
 */
export interface ParserState {
    /** The failing token's type. */
    type: acorn.TokenType;
    /** The failing token's value, if any. */
    value: unknown;
    /** The failing token's start offset. */
    start: number;
    /** The failing token's end offset. */
    end: number;
    /** The end offset of the token before the failing one. */
    lastTokEnd: number;
    /**
     * The open-delimiter stack, innermost last, as the raw token labels
     * (e.g. `"{"`, `"("`, `` "`" ``, `"function"`, &c.) from Acorn's
     * `TokContext` objects.
     */
    context: string[];
}

/**
 * Internal Acorn parser properties.
 *
 * This is taken from `acorn/dist/acorn.js`. Note that these are very not part
 * of the public documented interface so may change as Acorn changes.
 */
interface AcornParserInternals {
    type?: unknown;
    value?: unknown;
    start?: unknown;
    end?: unknown;
    lastTokEnd?: unknown;
    context?: unknown;
}

/**
 * Read `parser`'s undocumented internals and shape them into a `ParserState`.
 *
 * Returns `undefined` if the Acorn internals don't look like we expect.
 *
 * @param parser Parser instance at the moment it raised.
 * @returns The captured parser state, or `undefined` if the Acorn internals
 * have changed unexpectedly.
 */
function captureParserState(parser: acorn.Parser): ParserState | undefined {
    const internals = parser as unknown as AcornParserInternals;
    const { type, value, start, end, lastTokEnd, context } = internals;

    if (
        typeof start !== "number" ||
        typeof end !== "number" ||
        typeof lastTokEnd !== "number" ||
        typeof type !== "object" ||
        type === null ||
        typeof (type as acorn.TokenType).label !== "string"
    ) {
        return undefined;
    }

    if (!Array.isArray(context)) {
        return undefined;
    }

    const contextLabels: string[] = [];
    for (const frame of context) {
        if (
            typeof frame !== "object" ||
            frame === null ||
            typeof (frame as { token?: unknown }).token !== "string"
        ) {
            return undefined;
        }
        contextLabels.push((frame as { token: string }).token);
    }

    return {
        type: type as acorn.TokenType,
        value,
        start,
        end,
        lastTokEnd,
        context: contextLabels,
    };
}

/**
 * The signature of Acorn's own `Parser.prototype.raise` so we can type
 * the function we're wrapping.
 */
type RaiseFn = (this: acorn.Parser, pos: number, message: string) => never;

const baseRaise = (acorn.Parser.prototype as unknown as { raise: RaiseFn })
    .raise;

/**
 * An Acorn `SyntaxError` w/the parser state at the moment the error is raised.
 */
export type ErrorWithParserState = SyntaxError & {
    parserState?: ParserState;
};

/**
 * Subclass of Acorn's `Parser` that attaches a `parserState` payload to every
 * `SyntaxError` it raises, before rethrowing.
 */
export class ParserWithState extends acorn.Parser {
    raise(pos: number, message: string): never {
        try {
            baseRaise.call(this, pos, message);
        } catch (err) {
            if (err instanceof SyntaxError) {
                const parserState = captureParserState(this);
                if (parserState !== undefined) {
                    (err as ErrorWithParserState).parserState = parserState;
                }
            }
            throw err;
        }
        // Since `baseRaise` always throws, this will never be reached, but
        // you try telling TypeScript's control-flow analysis that.
        throw new Error("unreachable: Acorn's raise returned without throwing");
    }
}
