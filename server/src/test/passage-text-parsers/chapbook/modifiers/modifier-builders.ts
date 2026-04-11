import { ModifierInfo } from "../../../../passage-text-parsers/chapbook/modifiers";
import { ArgumentRequirement } from "../../../../passage-text-parsers/chapbook/types";

export function buildModifierInfo({
    name = "Mock Modifier",
    description = "Description",
    match = /^mock modifier/,
    firstArgRequired = ArgumentRequirement.ignored,
}): ModifierInfo {
    return {
        name: name,
        description: description,
        match: match,
        completions: [],
        firstArgument: { required: firstArgRequired },
        parse: () => {},
    };
}
