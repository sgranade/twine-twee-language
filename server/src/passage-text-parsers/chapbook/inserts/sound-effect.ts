import { ArgumentRequirement, InsertParser } from "./types";

export const soundEffect: InsertParser = {
    name: "sound effect",
    match: /^sound\s+effect/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { volume: null },
    },
    completions: ["sound effect"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as an expression
        }

        if (args.props.volume !== undefined) {
            // TODO parse as an expression
        }
    },
};
