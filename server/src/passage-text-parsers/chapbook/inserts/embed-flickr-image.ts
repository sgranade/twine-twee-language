import { ArgumentRequirement, InsertParser } from "./types";

export const embedFlickrImage: InsertParser = {
    name: "embed Flickr",
    description:
        "Renders an image hosted on Flickr with alt text specified by `alt`.",
    match: /^embed\s+flickr(\s+image)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'embed code'",
        },
        requiredProps: {},
        optionalProps: { alt: "'alternate text'" },
    },
    completions: ["embed Flickr"],
    parse(args, state, chapbookState) {},
};
