import { ArgumentRequirement, InsertParser } from "./types";

export const embedUnsplashImage: InsertParser = {
    name: "embed Unsplash image",
    match: /^embed\s+unsplash(\s+image)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { alt: null },
    },
    completions: ["embed Unsplash"],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.alt !== undefined) {
            // TODO parse as an expression
        }
    },
};
