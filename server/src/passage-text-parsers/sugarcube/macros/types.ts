/**
 * Macros that are parents of another macro.
 */
export interface MacroParent {
    /**
     * Name of the parent macro.
     */
    name: string;
    /**
     * Maximum number of times the child macro can appear in the parent.
     */
    max: number;
}
export namespace MacroParent {
    /**
     * Type guard for MacroParent.
     */
    export function is(val: any): val is MacroParent {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        const p = val as MacroParent;
        return p.name !== undefined && p.max !== undefined;
    }
}

/**
 * Information about a specific macro.
 */
export interface MacroInfo {
    /**
     * What to call this macro. (It's also how the macro is invoked)
     */
    name: string;
    /**
     * Is the macro a container? (Example: <<if>>...</if>)
     */
    container?: boolean;
    /**
     * What kind of arguments the macro takes. If boolean true, then it
     * takes arguments but we won't validate them. If boolean false,
     * then it doesn't accept arguments. If an array, it's the format of
     * the arguments as per the twee3-language-tools syntax
     * (https://github.com/cyrusfirheir/twee3-language-tools/blob/master/docs/parameters.md)
     * with the addition of "expression" to indicate that it takes a TwineScript expression.
     */
    arguments: boolean | string[];
    /**
     * Macro that is a parent of this macro.
     */
    parents?: (string | MacroParent)[];
    /**
     * Macro's syntax. Shown on hover; supports markdown.
     */
    syntax?: string;
    /**
     * Macro's description. Shown on hover; supports markdown.
     */
    description?: string;
    /**
     * SugarCube version when this macro became available.
     */
    since?: string;
    /**
     * SugarCube version when this macro became deprecated.
     */
    deprecated?: string;
    /**
     * SugarCube version when this function was removed.
     */
    removed?: string;
}
