import { capturePreTokenFor } from "../..";
import { ETokenType } from "../../../tokens";
import { ArgumentRequirement, InsertParser, ValueType } from "./types";

export const ambientSound: InsertParser = {
    name: "ambient sound",
    description:
        "Begins playing a previously-defined ambient sound. `volume` can be omitted; by default, the ambient sound is played at fulul volume.",
    match: /^ambient\s+sound/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.required,
            placeholder: "'sound name'",
        },
        requiredProps: {},
        optionalProps: {
            volume: { placeholder: "0.5", type: ValueType.number },
        },
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
    description: "Cancels all playing ambient sounds.",
    match: /^no ambient\s+sound/i,
    arguments: {
        firstArgument: { required: ArgumentRequirement.optional },
        requiredProps: {},
        optionalProps: {},
    },
    completions: ["no ambient sound"],
    parse: () => {},
};
