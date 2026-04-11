import { ModifierKind } from "../chapbook-parser";
import { ModifierInfo } from "./types";

export const css: ModifierInfo = {
    name: "CSS",
    syntax: "[CSS]",
    description:
        "Acts like a `<style>` tag in the passage; the contents of the text will be interpreted as CSS rules instead of normal text.",
    match: /^css$/i,
    completions: ["CSS"],
    parse(text, state, chapbookState) {
        chapbookState.modifierKind = ModifierKind.Css;
    },
};
