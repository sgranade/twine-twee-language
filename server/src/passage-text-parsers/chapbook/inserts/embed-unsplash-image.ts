import { ArgumentRequirement, InsertInfo } from "./types";

export const embedUnsplashImage: InsertInfo = {
    name: "embed Unsplash image",
    syntax: "{embed Unsplash image: 'URL', alt: 'alternate text'}\n{embed Unsplash: 'URL', alt: 'alternate text'}",
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
