import { ModifierParser } from "./types";

export const note: ModifierParser = {
    name: "note",
    match: /^(note(\s+to\s+myself)?|n\.?b\.?|todo|fixme)$/i,
    completions: ["note"],
};
