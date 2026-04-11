import { MacroInfo } from "./types";

export const addclassMacro: MacroInfo = {
    name: "addclass",
    arguments: ["text |+ text"],
    syntax: "<<addclass selector classNames>>",
    description: "Adds classes to the selected element(s).",
    since: "2.0.0",
};

export const appendMacro: MacroInfo = {
    name: "append",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<append selector [transition|t8n]>> … <</append>>",
    description:
        "Executes its contents and appends the output to the contents of the selected element(s).",
    since: "2.0.0",
};

export const copyMacro: MacroInfo = {
    name: "copy",
    arguments: ["text"],
    syntax: "<<copy selector>>",
    description: "Outputs a copy of the contents of the selected element(s).",
    since: "2.0.0",
};

export const prependMacro: MacroInfo = {
    name: "prepend",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<prepend selector [transition|t8n]>> … <</prepend>>",
    description:
        "Executes its contents and prepends the output to the contents of the selected element(s).",
    since: "2.0.0",
};

export const removeMacro: MacroInfo = {
    name: "remove",
    arguments: ["text"],
    syntax: "<<remove selector>>",
    description: "Removes the selected element(s).",
    since: "2.0.0",
};

export const removeclassMacro: MacroInfo = {
    name: "removeclass",
    arguments: ["text |+ text"],
    syntax: "<<removeclass selector classNames>>",
    description: "Remove classes to the selected element(s).",
    since: "2.0.0",
};

export const replaceMacro: MacroInfo = {
    name: "replace",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<replace selector [transition|t8n]>> … <</replace>>",
    description:
        "Executes its contents and replaces the contents of the selected element(s).",
    since: "2.0.0",
};

export const toggleclassMacro: MacroInfo = {
    name: "toggleclass",
    arguments: ["text |+ text"],
    syntax: "<<toggleclass selector classNames>>",
    description:
        "Toggles classes on the selected element(s)—i.e., adding them if they don't exist, removing them if they do.",
    since: "2.0.0",
};
