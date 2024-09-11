import { StoryFormatParser } from "..";
import { parsePassageText } from "./chapbook-parser";
import { generateCompletions } from "./chapbook-completions";
import { getDefinitionAt } from "./chapbook-definitions";
import { generateDiagnostics } from "./chapbook-diagnostics";
import { generateHover } from "./chapbook-hover";

/**
 * Get passage text parser for the Chapbook story format.
 *
 * @param formatVersion Specific Chapbook version.
 * @returns Parser, or undefined if none is available.
 */
export function getChapbookParser(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formatVersion: string | undefined
): StoryFormatParser | undefined {
    return {
        id: "chapbook-any",
        parsePassageText: parsePassageText,
        generateCompletions: generateCompletions,
        generateDiagnostics: generateDiagnostics,
        generateHover: generateHover,
        getDefinitionAt: getDefinitionAt,
        getReferencesToSymbolAt: () => undefined, // Chapbook doesn't need this
    };
}
