import { MacroInfo } from "../../../../passage-text-parsers/sugarcube/macros";

export function buildMacroInfo({
    name = "mockmacro",
    container = false,
    description = "placeholder desc",
    args = [],
}): MacroInfo {
    return {
        name: name,
        container: container,
        description: description,
        arguments: args,
    };
}
