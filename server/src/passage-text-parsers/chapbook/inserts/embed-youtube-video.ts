import { ArgumentRequirement, InsertParser } from "./types";

export const embedYouTubeVideo: InsertParser = {
    name: "embed YouTube video",
    match: /^embed\s+youtube(\s+video)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { autoplay: null, loop: null },
    },
    completions: ["embed YouTube"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
        if (args.props.autoplay !== undefined) {
            // TODO parse as an expression
        }
        if (args.props.loop !== undefined) {
            // TODO parse as an expression
        }
    },
};