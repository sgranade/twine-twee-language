import { SC2MacroInfo } from "@tt3/shared";
import { StoryFormatParser } from "..";
import { allMacros, allMacroEnums } from "./macros";
import { generateCompletions } from "./sugarcube-completions";
import { generateDiagnostics } from "./sugarcube-diagnostics";
import { generateHover } from "./sugarcube-hover";
import { getReferencesToSymbolAt } from "./sugarcube-references";
import { generateRenames } from "./sugarcube-renames";
import { parsePassageText } from "./sugarcube-parser";

export interface SugarCubeParserAPI {
    allMacros: typeof allMacros;
    allMacroEnums: typeof allMacroEnums;
}

const defaultSugarCubeParserAPI: SugarCubeParserAPI = {
    allMacros,
    allMacroEnums,
};

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
    formatVersion: string | undefined,
    api: SugarCubeParserAPI = defaultSugarCubeParserAPI,
): StoryFormatParser | undefined {
    return {
        id: "sugarcube-any",
        parsePassageText: (passageText, textIndex, state) =>
            parsePassageText(passageText, textIndex, state, api),
        generateCompletions: (document, position, deferred, index) =>
            generateCompletions(document, position, deferred, index, api),
        generateDiagnostics: generateDiagnostics,
        generateHover: (document, position, deferred, index) =>
            generateHover(document, position, deferred, index, api),
        getDefinitionAt: () => undefined, // Unneeded -- the index will find all definitions
        getReferencesToSymbolAt: getReferencesToSymbolAt,
        generateRenamesAt: generateRenames,
    };
}
