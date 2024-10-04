import { StoryFormatParser } from "..";
import { parsePassageText } from "./sugarcube-parser";

/**
 * Get passage text parser for the SugarCube story format.
 *
 * @param formatVersion Specific SugarCube version.
 * @returns Parser, or undefined if none is available.
 */
export function getSugarCubeParser(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    formatVersion: string | undefined
): StoryFormatParser | undefined {
    return {
        id: "sugarcube-any",
        parsePassageText: parsePassageText,
        generateCompletions: () => null,
        generateDiagnostics: () => [],
        generateHover: () => null,
        getDefinitionAt: () => undefined,
        getReferencesToSymbolAt: () => undefined,
    };
}
