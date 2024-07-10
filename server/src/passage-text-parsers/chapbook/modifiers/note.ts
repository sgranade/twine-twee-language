import { ModifierKind } from "../chapbook-parser";
import { ModifierParser } from "./types";

export const note: ModifierParser = {
    name: "note",
    match: /^(note(\s+to\s+myself)?|n\.?b\.?|todo|fixme)$/i,
    completions: ["note"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Note;
    },
};
