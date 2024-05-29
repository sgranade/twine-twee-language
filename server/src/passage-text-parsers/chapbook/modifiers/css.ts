import { ModifierParser } from "./types";

export const css: ModifierParser = {
    name: "CSS",
    match: /^css$/i,
    completions: ["CSS"],
};
