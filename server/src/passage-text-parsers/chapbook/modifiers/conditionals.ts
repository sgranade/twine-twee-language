import { ArgumentRequirement, ValueType } from "../types";
import { ModifierInfo } from "./types";

export const ifConditionals: ModifierInfo = {
    name: "if/unless conditional",
    syntax: "[if _expression_], [ifalways _expression_], [ifnever _expression_], [unless _expression_]",
    description: "Conditional display of text.",
    match: /^(if(always|never)?|unless)\s/i,
    completions: ["if", "ifalways", "ifnever", "unless"],
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: "expression",
        type: ValueType.expression,
    },
    parse: () => {},
};

export const elseConditional: ModifierInfo = {
    name: "conditionals",
    syntax: "[else]",
    description: "Conditional display of text.",
    match: /^else$/i,
    completions: ["else"],
    parse: () => {},
};
