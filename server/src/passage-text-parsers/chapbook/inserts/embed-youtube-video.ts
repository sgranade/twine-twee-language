import { ArgumentRequirement } from "../types";
import { InsertInfo } from "./types";

export const embedYouTubeVideo: InsertInfo = {
    name: "embed YouTube video",
    syntax: "{embed YouTube video: 'URL'}\n{embed YouTube: 'URL'}",
    description: "Renders a video player for a video hosted on YouTube.",
    match: /^embed\s+youtube(\s+video)?/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: "'url'",
    },
    requiredProps: {},
    optionalProps: { autoplay: "true", loop: "true" },
    completions: ["embed YouTube"],
    parse: () => {},
};
