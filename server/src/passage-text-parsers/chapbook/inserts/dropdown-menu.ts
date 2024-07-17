import { ArgumentRequirement, InsertParser } from "./types";

export const dropdownMenu: InsertParser = {
    name: "dropdown menu",
    description:
        "Renders a dropdown menu that runs through the options listed in `choices`, saving the option the player selected to the variable named. `for 'variable name'` can be omitted; Chapbook will not save the selected value anywhere.",
    match: /^dropdown\s+menu(\s+for)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.optional,
            placeholder: "'variableName'",
        },
        requiredProps: { choices: "['one', 'two', 'three']" },
        optionalProps: {},
    },
    completions: ["dropdown menu"],
    parse(args, state, chapbookState) {},
};
