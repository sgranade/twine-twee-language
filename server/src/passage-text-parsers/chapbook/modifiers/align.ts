import { ModifierParser } from "./types";

export const align: ModifierParser = {
    name: "align",
    description:
        "Causes the text to be aligned `left`, `center`, or `right`. Aligning left isn't needed under normal circumstances, but is included for completeness's sake--use `[continue]` instead.",
    match: /^align\s+(left|right|center)/i,
    completions: ["align left", "align right", "align center"],
    parse: () => {},
};
