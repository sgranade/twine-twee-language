import { ArgumentRequirement, InsertParser } from "./types";

export const cyclingLink: InsertParser = {
    name: "cycling link",
    description:
        "Renders a cycling link that runs through the options listed in `choices`, saving the option the player selected to the variable named. `for 'variable name'` can be omitted; Chapbook will not save the selected value anywhere.",
    match: /^cycling\s+link(\s+for)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.optional,
            placeholder: "'variableName'",
        },
        requiredProps: { choices: "['one', 'two', 'three']" },
        optionalProps: {},
    },
    completions: ["cycling link"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.choices !== undefined) {
            // TODO parse as an expression; should be an array
        }
    },
};
