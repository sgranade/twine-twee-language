import { ChapbookParsingState } from "../chapbook-parser";
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
export namespace Token {
    /**
     * Create a new Token literal.
     * @param text The token's text.
     * @param at The token's index in the document.
     */
    export function create(text: string, at: number): Token {
        return { text: text, at: at };
    }
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
 * Whether an insert's argument is required.
 */
export enum ArgumentRequirement {
    required,
    optional,
    ignored,
}

/**
 * What kind of value an insert argument or property takes.
 */
export enum ValueType {
    /**
     * Javascript expression
     */
    expression,
    /**
     * Number
     */
    number,
    /**
     * A Twine passage
     */
    passage,
    /**
     * Either a Twine passage or a URL link
     */
    urlOrPassage,
}

/**
 * Information about an insert property.
 */
export interface InsertProperty {
    type?: ValueType;
    placeholder: string;
}
export namespace InsertProperty {
    /**
     * Type guard for InsertProperty.
     */
    export function is(val: any): val is InsertProperty {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as InsertProperty).placeholder !== undefined;
    }
}

/**
 * An insert's expected arguments and completion/placeholder information.
 */
export interface InsertArguments {
    /**
     * Is a first argument required?
     */
    firstArgument: {
        required: ArgumentRequirement;
        placeholder?: string;
        type?: ValueType;
    };
    /**
     * Properties that must be present, with their placeholder (string) or full optional info.
     */
    requiredProps: Record<string, string | InsertProperty | null>;
    /**
     * Properties that may be present, with their optional info.
     */
    optionalProps: Record<string, string | InsertProperty | null>;
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
     * Which arguments the insert expects and completion/placeholder information about them.
     */
    arguments: InsertArguments;
    /**
     * List of completions corresponding to this insert's name.
     */
    completions: string[];
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
