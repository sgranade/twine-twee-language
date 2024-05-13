import { StoryFormat } from "../client-server";
import { ParsingState } from "../parser";
import { getChapbookParser } from "./chapbook";

/**
 * Story-format-specific parsers that parse passage text.
 */
export interface PassageTextParser {
    id: string;
    parsePassageText(
        passageText: string,
        textIndex: number,
        state: ParsingState
    ): void;
}

/**
 * Get a passage text parser for a given story format.
 *
 * @param format Story format.
 * @returns Parser, or undefined if no parser is available for the story format.
 */
export function getPassageTextParser(
    format: StoryFormat | undefined
): PassageTextParser | undefined {
    if (format?.format.toLowerCase() == "chapbook") {
        return getChapbookParser(format.formatVersion);
    }
    return undefined;
}
