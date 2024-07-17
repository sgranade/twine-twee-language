import { ArgumentRequirement, InsertParser } from "./types";

export const backLink: InsertParser = {
    name: "back link",
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
