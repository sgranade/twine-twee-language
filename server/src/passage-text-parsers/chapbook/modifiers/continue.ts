import { ModifierParser } from "./types";

export const cont: ModifierParser = {
    name: "continue",
    description: "Clears all previously active modifiers.",
    match: /^continued?|cont('d)?$/i,
    completions: ["continue"],
    parse: () => {},
};
