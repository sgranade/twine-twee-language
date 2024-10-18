import { MacroInfo } from "./types";

export const equalsMacro: MacroInfo = {
    name: "=",
    arguments: ["expression"],
    syntax: "<<= expression>>",
    description:
        "Outputs a string representation of the result of the given expression. This macro is an alias for `<<print>>`.",
    since: "2.0.0",
};

export const minusMacro: MacroInfo = {
    name: "-",
    arguments: ["expression"],
    syntax: "<<- expression>>",
    description:
        "Outputs a string representation of the result of the given expression. This macro is functionally identical to `<<print>>`, save that it also encodes HTML special characters in the output.",
    since: "2.0.0",
};

export const doMacro: MacroInfo = {
    name: "do",
    container: true,
    arguments: ["|+ ('tag' &+ string) |+ ('element' &+ text)"],
    syntax: "<<do [tag tags] [element tag]>> … <</do>>",
    description:
        "Displays its contents. Listens for `<<redo>>` macro commands upon which it updates its contents.",
    since: "2.0.0",
};

export const includeMacro: MacroInfo = {
    name: "include",
    arguments: ["passage|linkNoSetter |+ text"],
    syntax: "<<include passageName [elementName]>>\n<<include linkMarkup [elementName]>>",
    description:
        "Outputs the contents of the passage with the given name, optionally wrapping it within an HTML element. May be called either with the passage name or with a link markup.",
    since: "2.15.0",
};

export const nobrMacro: MacroInfo = {
    name: "nobr",
    container: true,
    arguments: false,
    syntax: "<<nobr>> … <</nobr>>",
    description:
        "Executes its contents and outputs the result, after removing leading/trailing newlines and replacing all remaining sequences of newlines with single spaces.",
    since: "2.0.0",
};

export const printMacro: MacroInfo = {
    name: "print",
    arguments: ["expression"],
    syntax: "<<print expression>>",
    description:
        "Outputs a string representation of the result of the given expression.",
    since: "2.0.0",
};

export const redoMacro: MacroInfo = {
    name: "redo",
    arguments: ["...text"],
    syntax: "<<redo [tags]>>",
    description:
        "Causes one or more `<<do>>` macros to update their contents. If tags are omitted, sends the update to all `<<do>>` macros.",
    since: "2.37.0",
};

export const silentMacro: MacroInfo = {
    name: "silent",
    container: true,
    arguments: false,
    syntax: "<<silent>> … <</silent>>",
    description:
        "Causes any output generated within its body to be discarded, except for errors (which will be displayed). Generally, only really useful for formatting blocks of macros for ease of use/readability, while ensuring that no output is generated, from spacing or whatnot.",
    since: "2.37.0",
};

export const silentlyMacro: MacroInfo = {
    name: "silent",
    container: true,
    arguments: false,
    syntax: "<<silently>> … <</silently>>",
    description:
        "Causes any output generated within its body to be discarded, except for errors (which will be displayed). Generally, only really useful for formatting blocks of macros for ease of use/readability, while ensuring that no output is generated, from spacing or whatnot.",
    since: "2.0.0",
    deprecated: "2.37.0",
};

export const typeMacro: MacroInfo = {
    name: "type",
    container: true,
    arguments: true,
    syntax: "<<type speed [start delay] [class classes] [element tag] [id ID] [keep|none] [skipkey key]>>...</type>>",
    description:
        "Outputs its contents a character—technically, a code point—at a time, mimicking a teletype/typewriter. Can type most content: links, markup, macros, etc.",
    since: "2.32.0",
};
