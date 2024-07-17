import { ArgumentRequirement, InsertParser } from "./types";

export const embedYouTubeVideo: InsertParser = {
    name: "embed YouTube video",
    description: "Renders a video player for a video hosted on YouTube.",
    match: /^embed\s+youtube(\s+video)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'url'",
        },
        requiredProps: {},
        optionalProps: { autoplay: "true", loop: "true" },
    },
    completions: ["embed YouTube"],
    parse(args, state, chapbookState) {},
};
