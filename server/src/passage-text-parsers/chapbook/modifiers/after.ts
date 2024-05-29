import { ModifierParser } from "./types";

export const after: ModifierParser = {
    name: "after",
    match: /^after\s/i,
    completions: ["after"],
    parse: () => {},
};
