import { ModifierInfo } from "./types";

export const after: ModifierInfo = {
    name: "after",
    syntax: "[after _time_]",
    description:
        "Causes the text to appear after a certain amount of time has passed after hte passage is first displayed.",
    match: /^after\s/i,
    completions: ["after"],
    parse: () => {},
};
