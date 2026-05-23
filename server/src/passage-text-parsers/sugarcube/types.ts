import { ProjSymbol, TwineSymbolKind } from "../../project-index";

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
