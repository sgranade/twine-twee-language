import { ModifierType } from "../chapbook-parser";
import { ModifierParser } from "./types";

export const javascript: ModifierParser = {
    name: "JavaScript",
    match: /^javascript$/i,
    completions: ["JavaScript"],
    parse(text, state, chapbookState) {
        chapbookState.modifierType = ModifierType.Javascript;
    },
};
