import { ArgumentRequirement, InsertInfo } from "./types";

export const restartLink: InsertInfo = {
    name: "restart link",
    syntax: "{restart link, _label: 'label'_}",
    description:
        "Renders a link that restarts the story. `label` may be omitted; Chapbook will use 'Restart' in that instance.",
    match: /^restart\s+link/i,
    arguments: {
        firstArgument: { required: ArgumentRequirement.ignored },
        requiredProps: {},
        optionalProps: { label: "'label'" },
    },
    completions: ["restart link"],
    parse(args, state, chapbookState) {},
};
