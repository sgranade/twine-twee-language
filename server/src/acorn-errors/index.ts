import { dejargon } from "./dejargon";
import { ParseFailure } from "./parse-failure";
import type { ErrorWithParserState } from "./parser-state";
import {
    fallbackMessage,
    rules,
    unclosedDelimiterRule,
    unknownErrorMessage,
    unterminatedStringRule,
} from "./rules";
import type { ImprovedMessage } from "./rules";

/**
 * A `SyntaxError` as Acorn throws it plus possible `ParserWithState` state
 * info.
 */
export type AcornSyntaxError = ErrorWithParserState & {
    pos?: number;
    loc?: {
        line: number;
        column: number;
    };
    raisedAt?: number;
};

/**
 * Acorn messages that say only that something went wrong w/o    saying what.
 */
function isGenericMessage(message: string): boolean {
    return (
        message.startsWith("Unexpected token") ||
        message.startsWith("Unexpected character") ||
        message.startsWith("Unexpected keyword") ||
        message.includes("Unexpected token")
    );
}

/**
 * Find the best fix for a given parsing error.
 *
 * @param candidates Improved error messages proposed by the rules, in rule order.
 * @param pos Position Acorn reported the failure at.
 * @returns The winning message, or `undefined` if there are no candidates.
 */
function arbitrate(
    candidates: ImprovedMessage[],
    pos: number,
): ImprovedMessage | undefined {
    // A rule shouldn't report a position past the failure, since every rule
    // recognizes something Acorn had already read. If one does, it's still
    // better than nothing, so it's considered only when nothing else is.
    const atOrBefore = candidates.filter((c) => c.start <= pos);
    const eligible = atOrBefore.length > 0 ? atOrBefore : candidates;

    // The winner's the candidate closest to Acorn's reported position,
    // w/ties broken by rule order.
    let winner: ImprovedMessage | undefined;
    for (const candidate of eligible) {
        // `<`, not `<=`, so that an equal distance leaves the earlier (and
        // therefore higher-priority) rule in place.
        if (
            winner === undefined ||
            Math.abs(candidate.start - pos) < Math.abs(winner.start - pos)
        ) {
            winner = candidate;
        }
    }

    return winner;
}

/**
 * Improve Acorn's not-that-great error messages.
 *
 * @param text Text containing the error.
 * @param err Error as reported by Acorn.
 * @param offset Offset into the containing document where the expression occurs.
 * @returns Updated diagnostic in document-relative coords.
 */
export function improveAcornErrorMessage(
    text: string,
    err: AcornSyntaxError,
    offset = 0,
): {
    start: number;
    end: number;
    message: string;
} {
    const failure = new ParseFailure(text, err);

    // Function to rebase an error message's location to the passed offset
    const toResult = (improvedMessage: ImprovedMessage) => ({
        start: improvedMessage.start + offset,
        end: improvedMessage.end + offset,
        message: improvedMessage.message,
    });

    // Handle unterminated strings & templates 1st since they're lexical
    // failures w/no parser state.
    const unterminated = unterminatedStringRule(failure);
    if (unterminated !== undefined) return toResult(unterminated);

    if (!isGenericMessage(failure.message)) {
        return toResult(fallbackMessage(failure, dejargon(failure.message)));
    }

    const candidates: ImprovedMessage[] = [];
    let unclosedDelimiterCandidate: ImprovedMessage | undefined;
    for (const rule of rules) {
        const improvedMessage = rule(failure);
        if (improvedMessage === undefined) continue;
        if (rule === unclosedDelimiterRule) {
            unclosedDelimiterCandidate = improvedMessage;
        }
        candidates.push(improvedMessage);
    }

    // If the failure's at the end of the input, then all we know is "we ran
    // out of text", and the rule closest to that position doesn't actually
    // tell us anything. Given that, if we have a candidate unclosed delimeter,
    // return that outright.
    if (failure.isAtEof() && unclosedDelimiterCandidate !== undefined) {
        return toResult(unclosedDelimiterCandidate);
    }

    const winner = arbitrate(candidates, failure.pos);
    return toResult(
        winner ?? unknownErrorMessage(failure, failure.failingToken()),
    );
}
