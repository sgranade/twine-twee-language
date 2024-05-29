import { ArgumentRequirement, InsertParser } from "./types";

export const backLink: InsertParser = {
    name: "back link",
    match: /^back\s+link/i,
    arguments: {
        firstArgument: ArgumentRequirement.ignored,
        requiredProps: {},
        optionalProps: { label: null },
    },
    completions: ["back link"],
    parse(args, state, chapbookState) {
        if (args.props.label !== undefined) {
            // TODO parse as an expression
        }
    },
};
