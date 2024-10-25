/**
 * Custom-defined macros and enums as sent to the language server.
 */

import { parseMacroParameters } from "../sc2/t3lt-parameters";
import { MacroInfo } from "./types";

// Mapping of document URLs to the macros they define
const customMacroCache: Record<string, MacroInfo[]> = {};

/**
 * Set the custom macros defined by a document.
 *
 * @param uri URI to the document that has the custom macros.
 * @param macros Custom macros.
 */
export function setCustomMacros(uri: string, macros: MacroInfo[]) {
    customMacroCache[uri] = [...macros];
    for (const macro of customMacroCache[uri]) {
        if (Array.isArray(macro.arguments)) {
            const parsedArguments = parseMacroParameters(macro.arguments, {}); // TODO add enums!
            if (!(parsedArguments instanceof Error)) {
                macro.parsedArguments = parsedArguments;
            }
        }
    }
}

/**
 * Get the custom macros defined by a document.
 *
 * @param uri Document URI.
 * @returns Custom macros from that document, or undefined if none.
 */
export function getCustomMacros(uri: string): MacroInfo[] | undefined {
    const macros = customMacroCache[uri];
    if (macros !== undefined) {
        return [...macros];
    }
}

/**
 * Get all custom macros.
 *
 * @returns All custom macros as an object with the macros' names as the keys.
 */
export function getAllCustomMacros(): Record<string, MacroInfo> {
    const m = [];

    for (const macros of Object.values(customMacroCache)) {
        m.push(...macros);
    }

    return Object.fromEntries(m.map((el) => [el.name, el]));
}

/**
 * Remove custom macros defined in a document.
 *
 * @param uri Document URI to remove custom macros for.
 */
export function removeDocument(uri: string) {
    delete customMacroCache[uri];
}
