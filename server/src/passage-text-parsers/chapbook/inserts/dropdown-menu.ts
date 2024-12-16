import { ArgumentRequirement } from "../types";
import { InsertInfo } from "./types";

export const dropdownMenu: InsertInfo = {
    name: "dropdown menu",
    syntax: "{dropdown menu _for 'variableName'_, choices: ['one', 'two', 'three']}",
    description:
        "Renders a dropdown menu that runs through the options listed in `choices`, saving the option the player selected to the variable named. `for 'variableName'` can be omitted; Chapbook will not save the selected value anywhere.",
    match: /^dropdown\s+menu(\s+for)?/i,
    firstArgument: {
        required: ArgumentRequirement.optional,
        placeholder: '"variableName"',
    },
    requiredProps: { choices: '["one", "two", "three"]' },
    optionalProps: {},
    completions: ["dropdown menu"],
    parse: () => {},
};
