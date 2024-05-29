import { ArgumentRequirement, InsertParser } from "./types";

export const dropdownMenu: InsertParser = {
    name: "dropdown menu",
    match: /^dropdown\s+menu(\s+for)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.optional,
        requiredProps: {},
        optionalProps: { choices: null },
    },
    completions: ["dropdown menu"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.choices !== undefined) {
            // TODO parse as an expression; should be an array
        }
    },
};
