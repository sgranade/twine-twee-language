import { ArgumentRequirement } from "../types";
import { InsertInfo } from "./types";

export const cyclingLink: InsertInfo = {
    name: "cycling link",
    syntax: "{cycling link _for 'variableName'_, choices: ['one', 'two', 'three']}",
    description:
        "Renders a cycling link that runs through the options listed in `choices`, saving the option the player selected to the variable named. `for 'variableName'` can be omitted; Chapbook will not save the selected value anywhere.",
    match: /^cycling\s+link(\s+for)?/i,
    firstArgument: {
        required: ArgumentRequirement.optional,
        placeholder: "'variableName'",
    },
    requiredProps: { choices: "['one', 'two', 'three']" },
    optionalProps: {},
    completions: ["cycling link"],
    parse: () => {},
};
