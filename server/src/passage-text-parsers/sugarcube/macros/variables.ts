import { tokenizeTwineScript } from "../sc2/sc2-twinescript";
import { createVariableAndPropertyReferences } from "../sugarcube-utils";
import { MacroInfo, parseArgsAsTwineScript } from "./types";

export const captureMacro: MacroInfo = {
    name: "capture",
    container: true,
    arguments: ["...var"],
    syntax: "<<capture variableList>>...<</capture>>",
    description:
        "Captures story `$variables` and temporary `_variables`, creating localized versions of their values within the macro body.",
    since: "2.14.0",
};

export const setMacro: MacroInfo = {
    name: "set",
    syntax: "<<set expression>>",
    description:
        "Sets story `$variables` and temporary `_variables` based on the given expression.",
    since: "2.0.0",
    parseArgs: (args, argsIndex, state, sugarcubeState) =>
        parseArgsAsTwineScript(args, argsIndex, state, sugarcubeState, {
            isSetterContext: true,
        }),
};

export const unsetMacro: MacroInfo = {
    name: "unset",
    arguments: ["...var"],
    syntax: "<<unset variableList>>",
    description: "Unsets story `$variables` and temporary `_variables`.",
    since: "2.0.0",
    parseArgs: (args, argsIndex, state, sugarcubeState) => {
        // SugarCube splits the list on commas, semicolons and whitespace
        for (const m of (args ?? "").matchAll(/[^\s,;]+/g)) {
            createVariableAndPropertyReferences(
                tokenizeTwineScript(
                    m[0],
                    argsIndex + m.index,
                    state.textDocument,
                    sugarcubeState,
                ),
                state,
                sugarcubeState,
            );
        }
        return true;
    },
};
