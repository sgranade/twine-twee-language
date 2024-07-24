import { ArgumentRequirement, InsertInfo } from "./types";

export const embedImage: InsertInfo = {
    name: "embed image",
    syntax: "{embed image: 'url', alt: 'alternate text'}",
    description:
        "Renders an image at a particular URL with alt text specified by `alt`.",
    match: /^embed\s+image/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'url'",
        },
        requiredProps: {},
        optionalProps: { alt: "'alternate text'" },
    },
    completions: ["embed image"],
    parse(args, state, chapbookState) {},
};
