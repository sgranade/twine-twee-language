import { logErrorFor } from "../../../parser";
import { ArgumentRequirement, ValueType } from "../types";
import { InsertInfo } from "./types";

export const embedPassage: InsertInfo = {
    name: "embed passage",
    syntax: "{embed passage named: 'passage name'}\n{embed passage: 'passage name'}",
    description:
        "Renders the passage named in the insert. This executed any vars section in that passage.",
    match: /^embed\s+passage(\s+named)?/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: '"passage name"',
        type: ValueType.passage,
    },
    requiredProps: {},
    optionalProps: {},
    completions: ["embed passage"],
    parse(args, state) {
        if (args.firstArgument) {
            // If the first argument is a string, it's a passage. Otherwise it has to be a variable
            if (
                !/^(['"])(.*)\1$/.test(args.firstArgument.text) &&
                !/^\S*$/.test(args.firstArgument.text)
            ) {
                logErrorFor(
                    args.firstArgument.text,
                    args.firstArgument.at,
                    "Must be a string or variable containing a passage name or a variable",
                    state
                );
            }
        }
    },
};
