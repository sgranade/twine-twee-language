import { MacroInfo } from "./types";

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
    arguments: ["expression"],
    syntax: "<<set expression>>",
    description:
        "Sets story `$variables` and temporary `_variables` based on the given expression.",
    since: "2.0.0",
};

export const unsetMacro: MacroInfo = {
    name: "unset",
    arguments: ["...var"],
    syntax: "<<unset variableList>>",
    description: "Unsets story `$variables` and temporary `_variables`.",
    since: "2.0.0",
};
