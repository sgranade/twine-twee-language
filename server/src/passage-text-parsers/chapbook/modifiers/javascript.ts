import { ModifierKind } from "../chapbook-parser";
import { ModifierInfo } from "./types";

export const javascript: ModifierInfo = {
    name: "JavaScript",
    syntax: "[JavaScript]",
    description:
        "Acts like a `<script>` tag in the passage; the contents of the text will be interpreted as JavaScript code instead of normal text. To write output from inside the text, use the function `write()`.",
    match: /^javascript$/i,
    completions: ["JavaScript"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Javascript;
    },
};
