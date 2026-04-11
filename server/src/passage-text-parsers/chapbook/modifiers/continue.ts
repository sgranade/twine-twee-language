import { ModifierKind } from "../chapbook-parser";
import { ModifierInfo } from "./types";

export const cont: ModifierInfo = {
    name: "continue",
    syntax: "[continue], [cont'd], [cont]",
    description: "Clears all previously active modifiers.",
    match: /^continued?|cont('d)?$/i,
    completions: ["continue"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Continue;
    },
};
