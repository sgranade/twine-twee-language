import { TwineSymbolKind } from "../../project-index";

/**
 * Kind of a SugarCube symbol.
 */
export const OSugarCubeSymbolKind = {
    KnownMacro: TwineSymbolKind._end + 1,
    UnknownMacro: TwineSymbolKind._end + 2,
    Variable: TwineSymbolKind._end + 3,
    Property: TwineSymbolKind._end + 4,
};
export type SugarCubeSymbolKind =
    (typeof OSugarCubeSymbolKind)[keyof typeof OSugarCubeSymbolKind];
