import { capturePreTokenFor } from "../..";
import { ETokenType } from "../../../tokens";
import { ArgumentRequirement, InsertParser } from "./types";

export const ambientSound: InsertParser = {
    name: "ambient sound",
    match: /^ambient\s+sound/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { volume: null },
    },
    completions: ["ambient sound"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            const m = /^(['"])(.*)\1$/.exec(args.firstArgument.text);
            if (m !== null) {
                capturePreTokenFor(
                    args.firstArgument.text,
                    args.firstArgument.at,
                    ETokenType.string,
                    [],
                    chapbookState
                );
            } else {
                // TODO parse as an expression
            }
        }

        if (args.props.volume !== undefined) {
            // TODO parse as an expression
        }
    },
};

// {no ambient sound} is, under the hood, just {ambient sound} with
// no first argument. Because that can be confusing to authors,
// pretend that the first argument isn't required.
export const noAmbientSound: InsertParser = {
    name: "no ambient sound",
    match: /^no ambient\s+sound/i,
    arguments: {
        firstArgument: ArgumentRequirement.optional,
        requiredProps: {},
        optionalProps: {},
    },
    completions: ["no ambient sound"],
    parse: () => {},
};
