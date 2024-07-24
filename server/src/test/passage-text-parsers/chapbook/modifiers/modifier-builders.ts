import { ModifierInfo } from "../../../../passage-text-parsers/chapbook/modifiers";

export function buildModifierInfo({
    name = "Mock Modifier",
    description = "Description",
    match = /^mock modifier/,
}): ModifierInfo {
    return {
        name: name,
        description: description,
        match: match,
        completions: [],
        parse: () => {},
    };
}
