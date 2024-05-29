import { ArgumentRequirement, InsertParser } from "./types";

export const cyclingLink: InsertParser = {
    name: "cycling link",
    match: /^cycling\s+link(\s+for)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.optional,
        requiredProps: {},
        optionalProps: { choices: null },
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
