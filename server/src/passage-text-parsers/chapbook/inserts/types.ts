import { ChapbookParsingState } from "..";
import { ParsingState } from "../../../parser";

/**
 * Token: an identifier and its index into the containing document.
 */
export interface Token {
    /**
     * Text value of the token.
     */
    text: string;
    /**
     * Index in the document where the token occurs.
     */
    at: number;
}

/**
 * Tokenized insert information.
 *
 * We don't type the properties since we're parsing and a user may
 * have entered properties that will be ignored.
 */
export interface InsertTokens {
    /**
     * Insert's name.
     */
    name: Token;
    /**
     * First argument to the insert, if any.
     */
    firstArgument: Token | undefined;
    /**
     * Properties as an array of [property name, property value] tokens.
     */
    props: [Token, Token][];
}

/**
 * An insert's expected arguments.
 */
export interface InsertArguments {
    firstArgument: boolean;
    requiredProps: Record<string, null>;
    optionalProps: Record<string, null>;
}

/**
 * A parser for a specific insert.
 */
export interface InsertParser {
    /**
     * What to call this insert.
     */
    name: string;
    /**
     * Regular expression that matches invocations of this insert.
     */
    match: RegExp;
    /**
     * Which arguments the insert expects.
     */
    arguments: InsertArguments;
    /**
     * Parses the insert.
     * @param tokens Tokenized insert information.
     * @param state Parsing state.
     * @param chapbookState Chapbook-specific parsing state.
     * @returns Any properties that the insert requires.
     */
    parse: (
        tokens: InsertTokens,
        state: ParsingState,
        chapbookState: ChapbookParsingState
    ) => undefined;
}
