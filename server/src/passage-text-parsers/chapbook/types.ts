import { ProjSymbol, TwineSymbolKind } from "../../project-index";
import { isVersionAtLeast, isVersionBefore } from "../../utilities";
import type { StoryFormatParsingState, ParsingState } from "../types";
import { Token } from "../../types";

/**
 * Whether a Chapbook function (modifier or insert)'s argument is required.
 */
export enum ArgumentRequirement {
    required,
    optional,
    ignored,
}

/**
 * What kind of value a modifier, insert argument, or property takes.
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
 * Information about a single insert property.
 */
export interface InsertProperty {
    type?: ValueType;
    placeholder?: string;
}
export namespace InsertProperty {
    /**
     * Type guard for InsertProperty.
     */
    export function is(val: unknown): val is InsertProperty {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as InsertProperty).placeholder !== undefined;
    }
}

/**
 * A record of insert properties by name and their placeholder or property information.
 */
export type InsertPropertyRecord = Record<
    string,
    string | InsertProperty | null
>;

/**
 * The first argument to a Chapbook function (i.e. insert or modifier).
 */
export interface FirstArgument {
    /**
     * Is the first argument required?
     */
    required: ArgumentRequirement;
    /**
     * Placeholder to use when auto-completing the function.
     */
    placeholder?: string;
    /**
     * Argument type.
     */
    type?: ValueType;
}

/**
 * A Chapbook function such as an insert or modifier.
 */
export interface ChapbookFunctionInfo {
    /**
     * What to call this function.
     */
    name?: string;
    /**
     * Regular expression that matches invocations of this function.
     */
    match: RegExp;
    /**
     * Function's syntax. Shown on hover; supports markdown.
     */
    syntax?: string;
    /**
     * Function's description. Shown on hover; supports markdown.
     */
    description?: string;
    /**
     * List of completions corresponding to this function.
     */
    completions?: string[];
    /**
     * Is there a required or optional first argument?
     */
    firstArgument?: FirstArgument;
    /**
     * For inserts, properties that must be present, with their placeholder (string) or full optional info.
     */
    requiredProps?: InsertPropertyRecord;
    /**
     * For inserts, properties that may be present, with their optional info.
     */
    optionalProps?: InsertPropertyRecord;
    /**
     * Chapbook version when this function became available.
     */
    since?: string;
    /**
     * Chapbook version when this function became deprecated.
     */
    deprecated?: string;
    /**
     * Chapbook version when this function was removed.
     */
    removed?: string;
}
export namespace ChapbookFunctionInfo {
    /**
     * Type guard for ChapbookSymbol.
     */
    export function is(val: unknown): val is ChapbookFunctionInfo {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as ChapbookFunctionInfo).match !== undefined;
    }
    /**
     * Is a function available in a given Chapbook version?
     *
     * @param info Function information.
     * @param version Chapbook version.
     * @returns True if the function is available in the Chapbook version; false otherwise.
     */
    export function exists(
        info: ChapbookFunctionInfo,
        version: string,
    ): boolean {
        // If the version's broken, just assume it's available
        if (info.since === undefined) return true;
        return (
            !isVersionBefore(version, info.since) &&
            !(
                info.removed !== undefined &&
                isVersionAtLeast(version, info.removed)
            )
        );
    }
    /**
     * Is a function deprecated in a given Chapbook version?
     *
     * @param info Function information.
     * @param version Chapbook version.
     * @returns True if the function is deprecated in the Chapbook version; false otherwise.
     */
    export function isDeprecated(
        info: ChapbookFunctionInfo,
        version: string,
    ): boolean {
        // If the version is broken, just assume it's not deprecated
        return (
            info.deprecated !== undefined &&
            isVersionAtLeast(version, info.deprecated)
        );
    }
}

/**
 * Kind of a Chapbook symbol.
 */
export const OChapbookSymbolKind = {
    BuiltInModifier: TwineSymbolKind._end + 1,
    BuiltInInsert: TwineSymbolKind._end + 2,
    CustomModifier: TwineSymbolKind._end + 3,
    CustomInsert: TwineSymbolKind._end + 4,
    Variable: TwineSymbolKind._end + 5,
    // Additional symbol for a variable being set in the vars section (the
    // regular variable symbol will also be captured)
    VariableSet: TwineSymbolKind._end + 6,
    Property: TwineSymbolKind._end + 7,
    PropertySet: TwineSymbolKind._end + 8,
    // A bare name in script code that might be a reference
    ConditionalReference: TwineSymbolKind._end + 9,
    // A root-level declaration in a story script file or `script` passage
    RootDeclaration: TwineSymbolKind._end + 10,
};
export type ChapbookSymbolKind =
    (typeof OChapbookSymbolKind)[keyof typeof OChapbookSymbolKind];

/**
 * A Chapbook symbol, which corresponds to a modifier, insert, or variable.
 */
export interface ChapbookSymbol extends ProjSymbol, ChapbookFunctionInfo {}
export namespace ChapbookSymbol {
    /**
     * Type guard for ChapbookSymbol.
     */
    export function is(val: unknown): val is ChapbookSymbol {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as ChapbookSymbol).match !== undefined;
    }
}

/**
 * Type of Chapbook modifier.
 */
export enum ModifierKind {
    None,
    Javascript,
    Css,
    Note,
    Continue,
    Other,
}

/**
 * Chapbook-specific parsing state information.
 */
export interface ChapbookParsingState extends StoryFormatParsingState {
    /**
     * Type of modifier affecting a text block.
     */
    modifierKind: ModifierKind;
    api: ChapbookParserAPI;
}

/**
 * Insert and modifier parsers used by the Chapbook parser.
 */
export interface ChapbookParserAPI {
    allInserts: () => readonly InsertInfo[];
    allModifiers: () => readonly ModifierInfo[];
}

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
 * A parser for a specific modifier.
 */
export interface ModifierInfo extends ChapbookFunctionInfo {
    /**
     * What to call this modifier. (Required for built-in modifiers.)
     */
    name: string;
    /**
     * Parses the modifier.
     * @param text Plain text of the modifier.
     * @param state Parsing state.
     * @param chapbookState Chapbook-specific parsing state.
     */
    parse: (
        text: string,
        state: ParsingState,
        chapbookState: ChapbookParsingState,
    ) => undefined;
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
        chapbookState: ChapbookParsingState,
    ) => undefined;
}
