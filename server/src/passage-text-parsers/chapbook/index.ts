import { PassageTextParser } from "..";
import { parsePassageText } from "./chapbook-parser";
import { generateCompletions } from "./chapbook-completions";

/**
 * Get passage text parser for the Chapbook story format.
 *
 * @param formatVersion Specific Chapbook version.
 * @returns Parser, or undefined if none is available.
 */
export function getChapbookParser(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formatVersion: string | undefined
): PassageTextParser | undefined {
    return {
        id: "chapbook-any",
        parsePassageText: parsePassageText,
        generateCompletions: generateCompletions,
    };
}
