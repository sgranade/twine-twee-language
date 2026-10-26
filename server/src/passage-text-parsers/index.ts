import { StoryFormat } from "@tt3/shared";
import { getChapbookParser } from "./chapbook";
import { getSugarCubeParser } from "./sugarcube";
import type { StoryFormatParser } from "./types";

/**
 * Get a passage text parser for a given story format.
 *
 * @param format Story format.
 * @returns Parser, or undefined if no parser is available for the story format.
 */
export function getStoryFormatParser(
    format: StoryFormat | undefined,
): StoryFormatParser | undefined {
    const formatName = format?.format.toLowerCase();
    if (formatName === "chapbook") {
        return getChapbookParser(format?.formatVersion);
    }
    if (formatName === "sugarcube") {
        return getSugarCubeParser(format?.formatVersion);
    }
    return undefined;
}
