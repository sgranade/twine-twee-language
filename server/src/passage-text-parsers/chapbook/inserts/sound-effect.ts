import { ArgumentRequirement, InsertParser, ValueType } from "./types";

export const soundEffect: InsertParser = {
    name: "sound effect",
    description:
        "Begins playing a previously-defined sound effect. `volume` can be omitted; by default, the ambient sound is played at full volume.",
    match: /^sound\s+effect/i,
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
