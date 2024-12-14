/**
 * Custom-defined macros and enums as sent to the language server.
 */

import * as YAML from "yaml";

import { hasOwnProperty } from "../../../utilities";
import { EnumRecord, parseMacroParameters } from "../sc2/t3lt-parameters";
import { MacroInfo, MacroParent } from "./types";

export interface MacrosAndEnums {
    macros: MacroInfo[];
    enums: EnumRecord;
}

// Mapping of document URIs to the macros and enums they define
const customMacroAndEnumCache: Record<string, MacrosAndEnums> = {};

/**
 * Set the custom macros and enums defined by a document.
 *
 * @param uri URI to the document that has the custom macros and enums.
 * @param macrosAndEnums Custom macros and enums.
 */
export function setCustomMacrosAndEnums(
    uri: string,
    macrosAndEnums: MacrosAndEnums
) {
    let enumsChanged = false;

    // See if any of the macro values have changed
    const oldEnums = customMacroAndEnumCache[uri]?.enums ?? {};
    if (
        Object.keys(oldEnums).length !==
        Object.keys(macrosAndEnums.enums).length
    ) {
        enumsChanged = true;
    } else
        for (const [oldName, oldValue] of Object.entries(oldEnums)) {
            if (oldValue !== macrosAndEnums.enums[oldName]) {
                enumsChanged = true;
                break;
            }
        }

    customMacroAndEnumCache[uri] = macrosAndEnums;

    const allEnums = getAllCustomMacroEnums();
    // If the macro enums have changed, re-parse all custom macros
    for (const macro of enumsChanged
        ? Object.values(getAllCustomMacros())
        : customMacroAndEnumCache[uri].macros) {
        if (Array.isArray(macro.arguments)) {
            const parsedArguments = parseMacroParameters(
                macro.arguments,
                allEnums
            );
            if (!(parsedArguments instanceof Error)) {
                macro.parsedArguments = parsedArguments;
            }
        }
    }
}

/**
 * Get all custom macros.
 *
 * @returns All custom macros as an object with the macros' names as the keys.
 */
export function getAllCustomMacros(): Readonly<Record<string, MacroInfo>> {
    const m = [];

    for (const macrosAndEnums of Object.values(customMacroAndEnumCache)) {
        m.push(...macrosAndEnums.macros);
    }

    return Object.fromEntries(m.map((el) => [el.name, el]));
}

/**
 * Get all custom macro enums.
 *
 * @returns All custom macro enums.
 */
export function getAllCustomMacroEnums(): Readonly<EnumRecord> {
    let ret = {};

    for (const macrosAndEnums of Object.values(customMacroAndEnumCache)) {
        ret = { ...ret, ...macrosAndEnums.enums };
    }

    return ret;
}

/**
 * Remove custom macros defined in a document.
 *
 * @param uri Document URI to remove custom macros for.
 */
export function removeDocument(uri: string) {
    delete customMacroAndEnumCache[uri];
}

/**
 * Twee-3-Language-Tools [custom macro definition](https://github.com/cyrusfirheir/twee3-language-tools?tab=readme-ov-file#custom-macro-definitions-for-sugarcube)
 */
interface T3LTMacroInfo {
    name?: string;
    description?: string;
    container?: boolean;
    children?: string | object[];
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
// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

interface TweeConfigFileConversionResults {
    macrosAndEnums?: MacrosAndEnums;
    errors: string[];
}

/**
 * Convert a T3LT JSON or YAML macro definition file into langauge-server-native MacroInfo objects and enums.
 *
 * @param str Contents of a *.twee-config.yaml/json file.
 * @param isYaml True if the contents are from a YAML file; false if from a JSON file.
 * @returns Macros and enums in the file, and any parsing errors.
 */
export function tweeConfigFileToMacrosAndEnums(
    str: string,
    isYaml: boolean
): TweeConfigFileConversionResults {
    const ret: TweeConfigFileConversionResults = {
        errors: [],
    };
    try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let output: any;
        if (isYaml) {
            output = YAML.parse(str, { merge: true });
        } else {
            output = JSON.parse(str);
        }

        if (typeof output !== "object" || output["sugarcube-2"] === undefined) {
            ret.errors.push("No `sugarcube-2` key found");
        } else {
            const macrosAndEnums: MacrosAndEnums = { macros: [], enums: {} };

            if (output["sugarcube-2"]) {
                // Macro definitions are in a "sugarcube-2" key, followed by "macros"
                const rawMacros = output["sugarcube-2"].macros;
                if (rawMacros !== undefined) {
                    macrosAndEnums.macros = t3ltMacrosToMacroInfos(rawMacros);
                }

                // Macro enum definitions are in a "sugarcube-2" key, followed by "enums"
                const rawEnums = output["sugarcube-2"].enums;
                if (rawEnums !== undefined) {
                    if (typeof rawEnums !== "object") {
                        ret.errors.push(
                            "enums must be a mapping of string keys to string values"
                        );
                    } else {
                        const badEnumNames: string[] = [];
                        const nonStringEnumNames: string[] = [];
                        const nonStringEnumVals: string[] = [];

                        for (const [k, v] of Object.entries(rawEnums)) {
                            if (typeof k !== "string") {
                                nonStringEnumNames.push(`${k}`);
                            } else if (!/^\w+$/.test(k)) {
                                badEnumNames.push(k);
                            } else if (typeof v !== "string") {
                                nonStringEnumVals.push(k);
                            } else {
                                macrosAndEnums.enums[k] = v;
                            }
                        }

                        if (
                            badEnumNames.length ||
                            nonStringEnumNames.length ||
                            nonStringEnumVals.length
                        ) {
                            let msg = "The enums had the following errors:";
                            if (badEnumNames.length) {
                                msg += `\nEnums whose names have illegal characters: ${badEnumNames.join(", ")}`;
                            }
                            if (nonStringEnumNames.length) {
                                msg += `\nEnums whose names aren't strings: ${nonStringEnumNames.join(", ")}`;
                            }
                            if (nonStringEnumVals.length) {
                                msg += `\nEnums whose values aren't strings: ${nonStringEnumVals.join(", ")}`;
                            }
                            ret.errors.push(msg);
                        }
                    }
                }
            }

            ret.macrosAndEnums = macrosAndEnums;
        }

        return ret;
    } catch (ex) {
        if (ex instanceof Error || hasOwnProperty(ex, "message")) {
            ret.errors.push(`${ex.message}`);
        } else {
            ret.errors.push("Unknown YAML parsing error");
        }

        return ret;
    }
}
