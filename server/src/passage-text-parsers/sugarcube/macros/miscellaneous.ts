import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { MacroInfo } from "./types";

export const doneMacro: MacroInfo = {
    name: "done",
    container: true,
    arguments: false,
    syntax: "<<done>>...<</done>>",
    description:
        "Silently executes its contents when the incoming passage is done rendering and has been added to the page. Generally, only really useful for running code that needs to manipulate elements from the incoming passage, since you must wait until they've been added to the page.",
    since: "2.35.0",
};

export const gotoMacro: MacroInfo = {
    name: "goto",
    arguments: ["passage|linkNoSetter"],
    syntax: "<<goto linkMarkup>>",
    description:
        "Immediately forwards the player to the passage with the given name. May be called either with the passage name or with a link markup.",
    since: "2.0.0",
};

export const repeatdelayMacro: MacroInfo = {
    name: "repeatdelay",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<repeat delay [transition|t8n]>> … <</repeat>>",
    description:
        "Repeatedly executes its contents after the given delay, inserting any output into the passage in its place. May be terminated by a `<<stop>>` macro.",
    since: "2.0.0",
};

export const stopMacro: MacroInfo = {
    name: "stop",
    arguments: false,
    parents: ["repeatdelay"],
    syntax: "<<stop>>",
    description:
        "Used within `<<repeat>>` macros. Terminates the execution of the current `<<repeat>>`.",
    since: "2.0.0",
};

export const timedMacro: MacroInfo = {
    name: "timed",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<timed delay [transition|t8n]>> …\n\t[<<next [delay]>> …]\n<</timed>>",
    description:
        "Executes its contents after the given delay, inserting any output into the passage in its place. Additional timed executions may be chained via `<<next>>`.",
    since: "2.0.0",
};

export const nextMacro: MacroInfo = {
    name: "next",
    arguments: ["|+ text"],
    parents: ["timed"],
    syntax: "<<next [delay]>>",
    description:
        "Executes the following contents after an additional delay. If `delay` isn't specified, it uses the delay value of its parent `<<timed>>` macro.",
    since: "2.0.0",
};

export const widgetMacro: MacroInfo = {
    name: "widget",
    container: true,
    arguments: ["text |+ 'container'"],
    syntax: "<<widget widgetName [container]>> … <</widget>>",
    description:
        "Creates a new widget macro (henceforth, widget) with the given name. Widgets allow you to create macros by using the standard macros and markup that you use normally within your story. All widgets may access arguments passed to them via the `_args` special variable. Block widgets may access the contents they enclose via the `_contents` special variable.",
    since: "2.0.0",
    parse(_args, _argsIndex, state) {
        // Widgets should be defined in passages with the widget tag
        if (
            state.currentPassage !== undefined &&
            !state.currentPassage.tags
                ?.map((l) => l.contents)
                .includes("widget")
        ) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    state.currentPassage.name.location.range,
                    `This passage contains <<widget>> macros, so needs a "widget" passage tag`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                )
            );
        }
        return false; // Keep on parsin'
    },
};
