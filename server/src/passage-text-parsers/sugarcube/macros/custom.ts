/**
 * Custom-defined macros and enums as sent to the language server.
 */

import * as YAML from "yaml";

import { parseMacroParameters } from "../sc2/t3lt-parameters";
import { MacroInfo, MacroParent } from "./types";
import { hasOwnProperty } from "../../../utilities";

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

/**
 * Twee-3-Language-Tools [custom macro definition](https://github.com/cyrusfirheir/twee3-language-tools?tab=readme-ov-file#custom-macro-definitions-for-sugarcube)
 */
interface T3LTMacroInfo {
    name?: string;
    description?: string;
    container?: boolean;
    children?: string | Object[];
    parents?: string[];
    deprecated?: boolean;
    parameters?: string[];
}

/**
 * Convert an object with Twee-3-Language-Tools macro objects into a MacroInfo array.
 *
 * The object's keys should be macro names and values whould match the T3LTMacroInfo interface.
 *
 * @param t3ltMacros T3LT macros.
 * @returns Macro information corresponding to the T3LT macros.
 */
function t3ltMacrosToMacroInfos(t3ltMacros: any): MacroInfo[] {
    const macros: MacroInfo[] = [];

    // Mapping of child macros to parent info
    // (Strictly speaking this should use a MacroChild interface, but it would
    // have the same info as MacroParent, so just re-purpose MacroParent)
    const childToParentInfo: Record<string, (string | MacroParent)[]> = {};
    for (const [name, rawInfo] of Object.entries(t3ltMacros)) {
        const t3ltInfo = rawInfo as T3LTMacroInfo;
        const macroInfo: MacroInfo = { name: name };

        if (t3ltInfo.name !== undefined) {
            macroInfo.name = t3ltInfo.name;
        }
        if (typeof t3ltInfo.description === "string") {
            macroInfo.description = t3ltInfo.description;
        }
        if (typeof t3ltInfo.container === "boolean") {
            macroInfo.container = t3ltInfo.container;
        }
        if (t3ltInfo.deprecated === true) {
            // Fake the funk by saying that this is deprecated since an early version
            macroInfo.deprecated = "0.1";
        }
        if (Array.isArray(t3ltInfo.parameters)) {
            macroInfo.arguments = [
                ...t3ltInfo.parameters.map((p) => p.toString()),
            ];
        }
        macros.push(macroInfo);

        // Record children info
        if (Array.isArray(t3ltInfo.children)) {
            for (const child of t3ltInfo.children) {
                let childName: string | undefined;
                let parentInfo: string | MacroParent | undefined;

                if (typeof child === "string") {
                    childName = child;
                    parentInfo = macroInfo.name;
                } else if (typeof child === "object") {
                    const childInfo = child as MacroParent;
                    if (typeof childInfo.name === "string") {
                        childName = childInfo.name;
                        if (typeof childInfo.max === "number") {
                            parentInfo = {
                                name: macroInfo.name,
                                max: childInfo.max,
                            };
                        } else {
                            parentInfo = macroInfo.name;
                        }
                    }
                }

                if (parentInfo !== undefined && childName !== undefined) {
                    const infoMapping: (string | MacroParent)[] =
                        childToParentInfo[childName] ?? [];
                    infoMapping.push(parentInfo);
                    childToParentInfo[childName] = infoMapping;
                }
            }
        }
    }

    // Move the child info into the actual macro info
    for (const macro of macros) {
        const parents = childToParentInfo[macro.name];
        if (parents !== undefined) {
            macro.parents = parents;
        }
    }

    return macros;
}

/**
 * Convert a T3LT JSON or YAML macro definition file into langauge-server-native MacroInfo objects.
 *
 * @param str Contents of a *.twee-config.yaml/json file.
 * @param isYaml True if the contents are from a YAML file; false if from a JSON file.
 * @returns Macros in the file, or Error if there was a parsing error.
 */
export function tweeConfigFileToMacro(
    str: string,
    isYaml: boolean
): MacroInfo[] | Error {
    try {
        let output: any;
        if (isYaml) {
            output = YAML.parse(str, { merge: true });
        } else {
            output = JSON.parse(str);
        }

        // Macro definitions are in a "sugarcube-2" key, followed by "macros"
        if (typeof output !== "object" || output["sugarcube-2"] === undefined) {
            return new Error("No `sugarcube-2` key found");
        }
        if (
            !output["sugarcube-2"] ||
            output["sugarcube-2"]["macros"] === undefined
        ) {
            return [];
        }
        return t3ltMacrosToMacroInfos(output["sugarcube-2"].macros);
    } catch (ex) {
        if (ex instanceof Error) {
            return ex;
        }
        if (hasOwnProperty(ex, "message") && typeof ex.message === "string") {
            return new Error(ex.message);
        }
        return new Error("Unknown YAML parsing error");
    }
}
