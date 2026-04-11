import { ParsingState } from "../../../parser";
import { ChapbookParsingState } from "../chapbook-parser";
import { ChapbookFunctionInfo } from "../types";

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
        chapbookState: ChapbookParsingState
    ) => undefined;
}
