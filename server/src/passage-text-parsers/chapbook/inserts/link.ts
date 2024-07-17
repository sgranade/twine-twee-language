import { capturePreTokenFor } from "../..";
import { parsePassageReference } from "../../../parser";
import { ETokenType } from "../../../tokens";
import { ArgumentRequirement, InsertParser, ValueType } from "./types";

export const link: InsertParser = {
    name: "link",
    description:
        "Renders a link to a passage name or address. `label` may be omitted; Chapbook will use the passage name or URL as label instead.",
    match: /^link\s+to/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'passage name or URL'",
            type: ValueType.urlOrPassage,
        },
        requiredProps: {},
        optionalProps: { label: "'label'" },
    },
    completions: ["link to"],
    parse(args, state, chapbookState) {
        // If the first arg isn't a URL, then it's a passage
        if (args.firstArgument) {
            // If the first argument is a string, it's either a URL or passage
            const m = /^(['"])(.*)\1$/.exec(args.firstArgument.text);
            if (m !== null) {
                const content = m[2];
                // If the first argument isn't a URL (which we decide by looking
                // for a leading protocol like https://), it's a passage reference
                if (!/^[a-zA-Z]+:\/\//.test(content)) {
                    parsePassageReference(
                        content,
                        args.firstArgument.at + 1,
                        state,
                        chapbookState
                    );
                }
            }
        }
    },
};
