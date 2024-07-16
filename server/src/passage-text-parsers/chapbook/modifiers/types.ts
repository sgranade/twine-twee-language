import { ParsingState } from "../../../parser";
import { ChapbookParsingState } from "../chapbook-parser";

/**
 * A parser for a specific modifier.
 */
export interface ModifierParser {
    /**
     * What to call this modifier.
     */
    name: string;
    /**
     * Description for the modifier. Shown on hover; supports markdown.
     */
    description: string;
    /**
     * Regular expression that matches invocations of this modifier.
     */
    match: RegExp;
    /**
     * List of completions corresponding to this modifier.
     */
    completions: string[];
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
