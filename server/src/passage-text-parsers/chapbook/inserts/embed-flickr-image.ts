import { ArgumentRequirement } from "../types";
import { InsertInfo } from "./types";

export const embedFlickrImage: InsertInfo = {
    name: "embed Flickr",
    syntax: "{embed Flickr image: 'embed code', alt: 'alternate text'}\n{embed Flickr: 'embed code', alt: 'alternate text'}",
    description:
        "Renders an image hosted on Flickr with alt text specified by `alt`.",
    match: /^embed\s+flickr(\s+image)?/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: '"embed code"',
    },
    requiredProps: {},
    optionalProps: { alt: '"alternate text"' },
    completions: ["embed Flickr"],
    parse: () => {},
};
