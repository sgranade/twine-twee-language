import { ModifierParser } from "./types";

export const conditionals: ModifierParser = {
    name: "conditionals",
    description: "Conditional display of text.",
    match: /^if(always|never)?\s|else$|unless\s/i,
    completions: ["if", "ifalways", "ifnever", "else", "unless"],
    parse: () => {},
};
