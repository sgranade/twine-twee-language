import { Symbol, TwineSymbolKind } from "../../project-index";
import { versionCompare } from "../../utilities";

/**
 * Whether an Chapbook function (modifier or insert)'s argument is required.
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
    export function is(val: any): val is InsertProperty {
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
    export function is(val: any): val is ChapbookFunctionInfo {
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
        version: string
    ): boolean {
        if (info.since === undefined) return true;
        if (info.removed === undefined)
            return versionCompare(version, info.since) >= 0;
        return (
            versionCompare(version, info.since) >= 0 &&
            versionCompare(version, info.removed) < 0
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
        version: string
    ): boolean {
        if (info.deprecated === undefined) return false;
        return versionCompare(version, info.deprecated) >= 0;
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
};
export type ChapbookSymbolKind =
    (typeof OChapbookSymbolKind)[keyof typeof OChapbookSymbolKind];
/**
 * A Chapbook symbol, which corresponds to a modifier, insert, or variable.
 */

export interface ChapbookSymbol extends Symbol, ChapbookFunctionInfo {}
export namespace ChapbookSymbol {
    /**
     * Type guard for ChapbookSymbol.
     */
    export function is(val: any): val is ChapbookSymbol {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as ChapbookSymbol).match !== undefined;
    }
}
