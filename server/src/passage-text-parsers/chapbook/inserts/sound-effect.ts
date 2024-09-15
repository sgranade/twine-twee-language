import { ArgumentRequirement, ValueType } from "../types";
import { InsertInfo } from "./types";

export const soundEffect: InsertInfo = {
    name: "sound effect",
    syntax: "{sound effect: 'sound name'_, volume: 0.5_}",
    description:
        "Begins playing a previously-defined sound effect. `volume` can be omitted; by default, the ambient sound is played at full volume.",
    match: /^sound\s+effect/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: "'sound name'",
    },
    requiredProps: {},
    optionalProps: {
        volume: { placeholder: "0.5", type: ValueType.number },
    },
    completions: ["sound effect"],
    parse: () => {},
};
