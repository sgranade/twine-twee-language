import { ModifierParser } from "./types";

export const after: ModifierParser = {
    name: "after",
    description:
        "Causes the text to appear after a certain amount of time has passed after hte passage is first displayed.",
    match: /^after\s/i,
    completions: ["after"],
    parse: () => {},
};
