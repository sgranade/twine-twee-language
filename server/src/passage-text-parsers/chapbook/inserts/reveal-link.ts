import { logErrorFor, logWarningFor } from "../../../parser";
import { ArgumentRequirement, ValueType } from "../types";
import { InsertInfo } from "./types";

export const revealLink: InsertInfo = {
    name: "reveal link",
    syntax: "{reveal link: 'label', text: 'revealed text'}\n{reveal link: 'label', passage: 'passage name'}",
    description:
        "Renders a link that expands to show either\n1. the `text` property (when defined) or\n2. the contents of the passage that has the name specified by the `passage` property (when defined)\nwhen clicked or tapped.",
    match: /^reveal\s+link/i,
    firstArgument: {
        required: ArgumentRequirement.required,
        placeholder: "'label'",
    },
    requiredProps: {},
    optionalProps: {
        text: "'revealed text'",
        passage: { placeholder: "'passage name'", type: ValueType.passage },
    },
    completions: ["reveal link"],
    parse(args, state) {
        const passageProp = args.props.passage;
        const textProp = args.props.text;
        // In reality, either text or passage property must be defined. If both are defined,
        // the text property wins out.
        if (textProp !== undefined) {
            if (passageProp !== undefined) {
                logWarningFor(
                    passageProp[0].text,
                    passageProp[0].at,
                    'The "passage" property will be ignored',
                    state
                );
            }
        } else if (passageProp === undefined) {
            logErrorFor(
                args.name.text,
                args.name.at,
                'Either the "passage" or "text" property must be defined',
                state
            );
        }
    },
};
