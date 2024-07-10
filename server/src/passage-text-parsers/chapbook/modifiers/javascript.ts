import { ModifierKind } from "../chapbook-parser";
import { ModifierParser } from "./types";

export const javascript: ModifierParser = {
    name: "JavaScript",
    match: /^javascript$/i,
    completions: ["JavaScript"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Javascript;
    },
};
