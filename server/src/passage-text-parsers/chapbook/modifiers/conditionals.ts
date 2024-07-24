import { ModifierInfo } from "./types";

export const conditionals: ModifierInfo = {
    name: "conditionals",
    syntax: "[if _expression_], [ifalways _expression_], [ifnever _expression_], [else], [unless _expression_]",
    description: "Conditional display of text.",
    match: /^if(always|never)?\s|else$|unless\s/i,
    completions: ["if", "ifalways", "ifnever", "else", "unless"],
    parse: () => {},
};
