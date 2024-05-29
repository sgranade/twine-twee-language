import { logErrorFor, parsePassageReference } from "../../../parser";
import { ArgumentRequirement, InsertParser } from "./types";

export const embedPassage: InsertParser = {
    name: "embed passage",
    match: /^embed\s+passage(\s+named)?/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: {},
    },
    completions: ["embed passage"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // If the first argument is a string, it's a passage
            const m = /^(['"])(.*)\1$/.exec(args.firstArgument.text);
            if (m !== null) {
                const content = m[2];
                parsePassageReference(
                    content,
                    args.firstArgument.at + 1,
                    state,
                    chapbookState
                );
            } else {
                logErrorFor(
                    args.firstArgument.text,
                    args.firstArgument.at,
                    "Must be a string containing a passage name",
                    state
                );
            }
        }
    },
};
