import { Range } from "vscode-languageserver";

import { ProjSymbol, TwineSymbolKind } from "../../project-index";
import type { StoryFormatParsingState } from "../types";
import type { MacroInfo } from "./macros/types";

/**
 * Kind of a SugarCube symbol.
 */
export const OSugarCubeSymbolKind = {
    KnownMacro: TwineSymbolKind._end + 1,
    UnknownMacro: TwineSymbolKind._end + 2,
    Variable: TwineSymbolKind._end + 3,
    // Additional symbol for a variable being set (the
    // regular variable symbol will also be captured)
    VariableSet: TwineSymbolKind._end + 4,
    Property: TwineSymbolKind._end + 5,
    PropertySet: TwineSymbolKind._end + 6,
};
export type SugarCubeSymbolKind =
    (typeof OSugarCubeSymbolKind)[keyof typeof OSugarCubeSymbolKind];

/**
 * A SugarCube symbol, which corresponds to a modifier, insert, or variable.
 */
export interface SugarCubeSymbol extends ProjSymbol {
    /**
     * Whether the symbol corresponds to a container macro.
     */
    container?: boolean;
}

/**
 * Location information about a macro
 */
export interface MacroLocationInfo {
    /**
     * The macro's name (ex: "if")
     */
    name: string;
    /**
     * The full text of a macro (ex: "<<if $v > 1>>")
     */
    fullText: string;
    /**
     * Index where the full text occurs.
     */
    at: number;
    /**
     * Macro ID, to disambiguate macros with the same name
     */
    id: number;
}

/**
 * SugarCube-specific parsing state information.
 */
export interface SugarCubeParsingState extends StoryFormatParsingState {
    /**
     * Container macros that are open (i.e. no close macro has been encountered).
     */
    unclosedMacros: MacroLocationInfo[];
    /**
     * Ranges of <<widget>> macros in the document, since they create variables.
     */
    widgetMacroRanges: Range[];
    api: SugarCubeParserAPI;
}

/**
 * A record mapping SugarCube macro enum names ("colors") to enumerated values
 * separated by pipes ('"red"|"green"|"blue"|"pink"').
 */
export type EnumRecord = Record<string, string>;

/**
 * Macro and macro-enum lookups that the SugarCube parser uses.
 */
export interface SugarCubeParserAPI {
    allMacros: () => Readonly<Record<string, MacroInfo>>;
    allMacroEnums: () => Readonly<EnumRecord>;
}
