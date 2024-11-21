import { ParsingState } from "../../../parser";
import { StoryFormatParsingState } from "../..";
import { createVariableAndPropertyReferences } from "../sugarcube-utils";
import { tokenizeTwineScriptExpression } from "../sc2/sc2-twinescript";
import { Parameters } from "../sc2/t3lt-parameters";

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
    export function is(val: unknown): val is MacroParent {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        const p = val as MacroParent;
        return p.name !== undefined && p.max !== undefined;
    }
}

// Note on macro argument parsing order:
//
// First, if `MacroInfo.parse` is defined, it's called
//   If it returns true, then it's parsed successfully and no more parsing occurs
//   If it returns false, then parsing continues
//
// Second, if `MacroInfo.arguments` is undefined, parsing ends
//
// Third, if `MacroInfo.parsedArguments` is defined, then T3LT-style validation occurs
//
// Fourth, the arguments parsed into T3LT tokens are used to generate references and sematic tokens
//
// Finally, if `MacroInfo.arguments` is true/false, then warnings are generated if there are arguments
// where none are expected (`MacroInfo.arguments = false`) or there are none where there should be some
// (`MacroInfo.arguments = true`).

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
     * What kind of arguments the macro takes. If undefined, we don't validate
     * any arguments one way or the other. If boolean true, then it
     * requires arguments but we won't validate them. If boolean false,
     * then it doesn't accept arguments. If an array, it's the format of
     * the arguments as per the [twee3-language-tools (T3LT) syntax]
     * (https://github.com/cyrusfirheir/twee3-language-tools/blob/master/docs/parameters.md).
     */
    arguments?: boolean | string[];
    /**
     * Macro arguments parsed into T3LT parameters.
     */
    parsedArguments?: Parameters;
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
    /**
     * Parses the macro's arguments.
     *
     * A macro's custom parse function is called before any other argument parsing
     * occurs, and is called whether or not the `arguments` property is set.
     * If it returns true, then no further parsing occurs. If it returns false,
     * then regular parsing continues.
     *
     * If it stops all further parsing, then the function is solely responsible for
     * setting all semantic tokens and any variable or passage references.
     *
     * @param args Unparsed arguments.
     * @param argsIndex Index of the unparsed arguments in the larger document (zero-based).
     * @param state Parsing state.
     * @param sugarcubeState SugarCube-specific parsing state.
     * @returns True to indicate that parsing is complete, or false to let parsing continue.
     */
    parse?: (
        args: string | undefined,
        argsIndex: number,
        state: ParsingState,
        sugarcubeState: StoryFormatParsingState
    ) => boolean;
}

/**
 * Utility function for macros who parse their arguments as a TwineScript expression.
 *
 * @param args Unparsed arguments.
 * @param argsIndex Index of the unparsed arguments in the larger document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns True to indicate that parsing is complete, or false to let parsing continue.
 */
export function parseArgsAsTwineScriptExpression(
    args: string | undefined,
    argsIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): boolean {
    if (args !== undefined) {
        createVariableAndPropertyReferences(
            tokenizeTwineScriptExpression(
                args,
                argsIndex,
                state.textDocument,
                sugarcubeState
            ),
            state
        );
    }
    return true;
}
