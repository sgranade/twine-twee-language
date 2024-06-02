import { capturePreTokenFor } from "../..";
import { parsePassageReference } from "../../../parser";
import { ETokenType } from "../../../tokens";
import { ArgumentRequirement, InsertParser, ValueType } from "./types";

export const link: InsertParser = {
    name: "link",
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
                // If the first argument is a URL (which we decide by looking
                // for a leading protocol like https://), it's a string.
                if (/^[a-zA-Z]+:\/\//.test(content)) {
                    capturePreTokenFor(
                        args.firstArgument.text,
                        args.firstArgument.at,
                        ETokenType.string,
                        [],
                        chapbookState
                    );
                }
                // Otherwise it's a passage
                else {
                    parsePassageReference(
                        content,
                        args.firstArgument.at + 1,
                        state,
                        chapbookState
                    );
                }
            } else {
                // TODO it's an expression. Parse as such.
            }
        }

        if (args.props.label !== undefined) {
            const [, val] = args.props.label;
            if (/^(['"])(.*)\1$/.test(val.text)) {
                capturePreTokenFor(
                    val.text,
                    val.at,
                    ETokenType.string,
                    [],
                    chapbookState
                );
            } else {
                // TODO parse as an expression
            }
        }
    },
};
