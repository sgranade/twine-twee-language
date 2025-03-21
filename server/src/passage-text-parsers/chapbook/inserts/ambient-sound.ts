import { ArgumentRequirement, ValueType } from "../types";
import { InsertInfo } from "./types";

export const ambientSound: InsertInfo = {
    name: "ambient sound",
    syntax: "{ambient sound: 'sound name', _volume: 0.5_}",
    description:
        "Begins playing a previously-defined ambient sound. `volume` can be omitted; by default, the ambient sound is played at full volume.",
    match: /^ambient\s+sound/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: '"sound name"',
    },
    requiredProps: {},
    optionalProps: {
        volume: { placeholder: "0.5", type: ValueType.number },
    },
    completions: ["ambient sound"],
    parse: () => {},
};

// {no ambient sound} is, under the hood, just {ambient sound} with
// no first argument. Because that can be confusing to authors,
// pretend that the first argument isn't required.
export const noAmbientSound: InsertInfo = {
    name: "no ambient sound",
    syntax: "{no ambient sound}",
    description: "Cancels all playing ambient sounds.",
    match: /^no ambient\s+sound/i,
    firstArgument: { required: ArgumentRequirement.optional },
    requiredProps: {},
    optionalProps: {},
    completions: ["no ambient sound"],
    parse: () => {},
};
