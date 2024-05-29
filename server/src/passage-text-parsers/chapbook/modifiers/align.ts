import { ModifierParser } from "./types";

export const align: ModifierParser = {
    name: "align",
    match: /^align\s+(left|right|center)/i,
    completions: ["align left", "align right", "align center"],
};
