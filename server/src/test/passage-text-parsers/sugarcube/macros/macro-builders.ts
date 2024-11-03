import { MacroInfo } from "../../../../passage-text-parsers/sugarcube/macros";
import {
    Parameters,
    parseMacroParameters,
} from "../../../../passage-text-parsers/sugarcube/sc2/t3lt-parameters";

export function buildMacroInfo({
    name = "mockmacro",
    container = false,
    description = "placeholder desc",
}): MacroInfo {
    return {
        name: name,
        container: container,
        description: description,
    };
}

export function buildMacroInfoWithArgs({
    name = "mockmacro",
    container = false,
    description = "placeholder desc",
    args = ["boolean"],
}): MacroInfo {
    const macro = buildMacroInfo({ name, container, description });
    macro.arguments = args;
    const parsedArguments = parseMacroParameters(macro.arguments, {});
    macro.parsedArguments =
        parsedArguments instanceof Parameters ? parsedArguments : undefined;
    return macro;
}
