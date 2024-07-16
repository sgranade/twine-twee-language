import { ArgumentRequirement, InsertParser } from "./types";

export const restartLink: InsertParser = {
    name: "restart link",
    description:
        "Renders a link that restarts the story. `label` may be omitted; Chapbook will use 'Restart' in that instance.",
    match: /^restart\s+link/i,
    arguments: {
        firstArgument: { required: ArgumentRequirement.ignored },
        requiredProps: {},
        optionalProps: { label: "'label'" },
    },
    completions: ["restart link"],
    parse(args, state, chapbookState) {
        if (args.props.label !== undefined) {
            // TODO parse as an expression
        }
    },
};
