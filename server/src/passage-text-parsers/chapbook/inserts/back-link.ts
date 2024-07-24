import { ArgumentRequirement, InsertInfo } from "./types";

export const backLink: InsertInfo = {
    name: "back link",
    syntax: "{back link, _label: 'Back'_}",
    description:
        "Renders a link to the previous passage. `label` can be omitted; Chapbook will default to using 'Back'.",
    match: /^back\s+link/i,
    arguments: {
        firstArgument: { required: ArgumentRequirement.ignored },
        requiredProps: {},
        optionalProps: { label: "'Back'" },
    },
    completions: ["back link"],
    parse(args, state, chapbookState) {},
};
