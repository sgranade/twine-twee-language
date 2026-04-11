import { SC2MacroInfo } from "../../client-server";
import { StoryFormatParser } from "..";
import { generateCompletions } from "./sugarcube-completions";
import { generateDiagnostics } from "./sugarcube-diagnostics";
import { generateHover } from "./sugarcube-hover";
import { parsePassageText } from "./sugarcube-parser";
import { allMacros } from "./macros";

/**
 * Get the names of all the known SugarCube 2 macros.
 *
 * @returns List of all macro names.
 */
export function getSugarCubeMacroInfo(): SC2MacroInfo[] {
    return Object.values(allMacros()).map((info) => {
        return {
            name: info.name,
            isContainer: !!info.container,
            isChild: !!(info.parents && info.parents.length > 0),
        };
    });
}

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
        generateCompletions: generateCompletions,
        generateDiagnostics: generateDiagnostics,
        generateHover: generateHover,
        getDefinitionAt: () => undefined, // Unneeded -- the index will find all definitions
        getReferencesToSymbolAt: () => undefined, // Unneeded -- the index will find all references
    };
}
