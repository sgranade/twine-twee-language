import { MacroInfo } from "./types";

export const runMacro: MacroInfo = {
    name: "run",
    arguments: true,
    syntax: "<<run expression>>",
    description:
        "Runs given expression.\n\n*Functionally identical to `<<set>>`. Intended to be mnemonically better for uses where the expression is arbitrary code, rather than variables to set—i.e., `<<run>>` to run code, `<<set>>` to set variables.*",
    since: "2.0.0",
};

export const scriptMacro: MacroInfo = {
    name: "script",
    container: true,
    arguments: undefined, // Since it's an optional argument
    syntax: "<<script [language]>>...<</script>>",
    description:
        "Silently executes its contents as either JavaScript or TwineScript code (default: JavaScript).",
    since: "2.0.0",
};
