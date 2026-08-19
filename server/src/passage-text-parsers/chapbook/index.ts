import { StoryFormatParser } from "..";
import { parsePassageText } from "./chapbook-parser";
import { generateCompletions } from "./chapbook-completions";
import { getDefinitionAt } from "./chapbook-definitions";
import { generateDiagnostics } from "./chapbook-diagnostics";
import { generateHover } from "./chapbook-hover";
import { getReferencesToSymbolAt } from "./chapbook-references";
import { all as allInserts } from "./inserts";
import { all as allModifiers } from "./modifiers";

export interface ChapbookParserAPI {
    allInserts: typeof allInserts;
    allModifiers: typeof allModifiers;
}

const defaultChapbookParserAPI: ChapbookParserAPI = {
    allInserts,
    allModifiers,
};

/**
 * Get passage text parser for the Chapbook story format.
 *
 * @param formatVersion Specific Chapbook version.
 * @returns Parser, or undefined if none is available.
 */
export function getChapbookParser(
    formatVersion: string | undefined,
    api: ChapbookParserAPI = defaultChapbookParserAPI,
): StoryFormatParser | undefined {
    return {
        id: "chapbook-any",
        parsePassageText: (passageText, textIndex, state) =>
            parsePassageText(passageText, textIndex, state, api),
        generateCompletions: (document, position, deferred, index) =>
            generateCompletions(document, position, deferred, index, api),
        generateDiagnostics: generateDiagnostics,
        generateHover: (document, position, deferred, index) =>
            generateHover(document, position, deferred, index, api),
        getDefinitionAt: getDefinitionAt,
        getReferencesToSymbolAt: getReferencesToSymbolAt,
        generateRenamesAt: () => null, // Unneeded -- the default logic works for us
    };
}
