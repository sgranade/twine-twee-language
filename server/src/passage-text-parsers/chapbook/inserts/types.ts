import { ChapbookParsingState } from "../chapbook-parser";
import { ChapbookFunctionInfo, FirstArgument, InsertProperty } from "../types";
import { ParsingState } from "../../../parser";
import { Token } from "../../types";

/**
 * Tokenized modifier information.
 */
export interface ModifierTokens {
    /**
     * Modifier's name as invoked.
     */
    name: Token;
    /**
     * First argument to the modifier, if any.
     */
    firstArgument: Token | undefined;
}

/**
 * Tokenized insert information.
 *
 * We don't type the properties since we're parsing and a user may
 * have entered properties that will be ignored.
 */
export interface InsertTokens {
    /**
     * Insert's name as invoked.
     */
    name: Token;
    /**
     * First argument to the insert, if any.
     */
    firstArgument: Token | undefined;
    /**
     * Properties as an object whose keys are the property name text and values
     * are [property name, property value] tokens.
     */
    props: Record<string, [Token, Token]>;
}

/**
 * A parser for a specific insert.
 */
export interface InsertInfo extends ChapbookFunctionInfo {
    /**
     * What to call this insert. (Required for built-in insert info.)
     */
    name: string;
    /**
     * Is there a required or optional first argument? (Required for built-in insert info)
     */
    firstArgument: FirstArgument;
    /**
     * Properties that must be present, with their placeholder (string) or full optional info.
     */
    requiredProps: Record<string, string | InsertProperty | null>;
    /**
     * Properties that may be present, with their optional info.
     */
    optionalProps: Record<string, string | InsertProperty | null>;
    /**
     * Parses the insert.
     * @param tokens Tokenized insert information.
     * @param state Parsing state.
     * @param chapbookState Chapbook-specific parsing state.
     */
    parse: (
        tokens: InsertTokens,
        state: ParsingState,
        chapbookState: ChapbookParsingState
    ) => undefined;
}
