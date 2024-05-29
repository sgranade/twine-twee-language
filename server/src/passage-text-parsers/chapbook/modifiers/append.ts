import { ModifierParser } from "./types";

export const append: ModifierParser = {
    name: "append",
    match: /^append$/i,
    completions: ["append"],
};
