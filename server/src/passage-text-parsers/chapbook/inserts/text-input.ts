import { ArgumentRequirement, InsertParser } from "./types";

export const textInput: InsertParser = {
    name: "text input",
    match: /^text\s+input(\s+for)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.optional,
        requiredProps: {},
        optionalProps: { required: null },
    },
    completions: ["text input"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as an expression
        }

        if (args.props.required !== undefined) {
            // TODO parse as an expression
        }
    },
};
