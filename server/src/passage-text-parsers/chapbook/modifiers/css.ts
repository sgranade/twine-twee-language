import { ModifierType } from "../chapbook-parser";
import { ModifierParser } from "./types";

export const css: ModifierParser = {
    name: "CSS",
    match: /^css$/i,
    completions: ["CSS"],
    parse(text, state, chapbookState) {
        chapbookState.modifierType = ModifierType.Css;
    },
};
