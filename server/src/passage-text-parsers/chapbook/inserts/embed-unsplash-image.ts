import { ArgumentRequirement, InsertParser } from "./types";

export const embedUnsplashImage: InsertParser = {
    name: "embed Unsplash image",
    description:
        "Renders an image hosted on Unsplash with alt text specified by `alt`.",
    match: /^embed\s+unsplash(\s+image)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'url'",
        },
        requiredProps: {},
        optionalProps: { alt: "'alternate text'" },
    },
    completions: ["embed Unsplash"],
    parse(args, state, chapbookState) {},
};
