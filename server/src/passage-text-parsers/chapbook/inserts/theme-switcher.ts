import { ArgumentRequirement } from "../types";
import { InsertInfo } from "./types";

export const themeSwitcher: InsertInfo = {
    name: "theme switcher",
    since: "2.1",
    syntax: "{theme switcher, _darkLabel: 'label'_, _lightLabel: 'label'_}",
    description:
        "Renders a link that switches between light and dark themes. `darkLabel` and `lightLabel` set the label shown when the theme is currently dark or light.",
    match: /^theme\s+switcher/i,
    firstArgument: { required: ArgumentRequirement.ignored },
    requiredProps: {},
    optionalProps: {
        darkLabel: { placeholder: "'label'" },
        lightLabel: { placeholder: "'label'" },
    },
    completions: ["theme switcher"],
    parse: () => {},
};
