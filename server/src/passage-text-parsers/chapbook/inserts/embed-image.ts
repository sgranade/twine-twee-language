import { ArgumentRequirement, InsertParser } from "./types";

export const embedImage: InsertParser = {
    name: "embed image",
    match: /^embed\s+image/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { alt: null },
    },
    completions: ["embed image"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.alt !== undefined) {
            // TODO parse as an expression
        }
    },
};
