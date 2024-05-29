import { ArgumentRequirement, InsertParser } from "./types";

export const restartLink: InsertParser = {
    name: "restart link",
    match: /^restart\s+link/i,
    arguments: {
        firstArgument: ArgumentRequirement.ignored,
        requiredProps: {},
        optionalProps: { label: null },
    },
    completions: ["restart link"],
    parse(args, state, chapbookState) {
        if (args.props.label !== undefined) {
            // TODO parse as an expression
        }
    },
};
