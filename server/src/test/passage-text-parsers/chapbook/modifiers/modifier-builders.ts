import { ModifierParser } from "../../../../passage-text-parsers/chapbook/modifiers";

export function buildModifierParser({
    name = "Mock Modifier",
    definition: description = "Description",
    match = /^mock modifier/,
}): ModifierParser {
    return {
        name: name,
        match: match,
        completions: [],
        parse: () => {},
    };
}
