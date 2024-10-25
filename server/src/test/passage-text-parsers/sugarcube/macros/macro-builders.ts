import { MacroInfo } from "../../../../passage-text-parsers/sugarcube/macros";

export function buildMacroInfo({
    name = "mockmacro",
    container = false,
    args = [],
}): MacroInfo {
    return {
        name: name,
        container: container,
        arguments: args,
    };
}
