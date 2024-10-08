import { ModifierKind } from "../chapbook-parser";
import { ModifierInfo } from "./types";

export const note: ModifierInfo = {
    name: "note",
    syntax: "[note to self], [note], [todo], [fixme]",
    description:
        "Causes the text to never be visible to the player. This is useful for leaving notes or other information for yourself.",
    match: /^(note(\s+to\s+myself)?|n\.?b\.?|todo|fixme)$/i,
    completions: ["note"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Note;
    },
};
