import { ArgumentRequirement, InsertParser } from "./types";

export const embedFlickrImage: InsertParser = {
    name: "embed Flickr",
    match: /^embed\s+flickr(\s+image)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { alt: null },
    },
    completions: ["embed Flickr"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.alt !== undefined) {
            // TODO parse as an expression
        }
    },
};
