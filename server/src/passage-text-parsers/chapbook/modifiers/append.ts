import { ModifierParser } from "./types";

export const append: ModifierParser = {
    name: "append",
    description:
        "Used in conjunction with another modifier to have text immediately follow the text preceding it, instead of appearing in a new paragraph.",
    match: /^append$/i,
    completions: ["append"],
    parse: () => {},
};
