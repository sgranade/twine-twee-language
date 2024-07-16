import { ModifierParser } from "../../../../passage-text-parsers/chapbook/modifiers";

export function buildModifierParser({
    name = "Mock Modifier",
    description = "Description",
    match = /^mock modifier/,
}): ModifierParser {
    return {
        name: name,
        description: description,
        match: match,
        completions: [],
        parse: () => {},
    };
}
