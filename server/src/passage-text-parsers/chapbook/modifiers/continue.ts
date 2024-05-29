import { ModifierParser } from "./types";

export const cont: ModifierParser = {
    name: "continue",
    match: /^continued?|cont('d)?$/i,
    completions: ["continue"],
};
