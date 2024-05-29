import {
    logErrorFor,
    logWarningFor,
    parsePassageReference,
} from "../../../parser";
import { ArgumentRequirement, InsertParser } from "./types";

export const revealLink: InsertParser = {
    name: "reveal link",
    match: /^reveal\s+link/i,
    arguments: {
        firstArgument: ArgumentRequirement.required,
        requiredProps: {},
        optionalProps: { text: null, passage: null },
    },
    completions: ["reveal link"],
    parse(args, state, chapbookState) {
        if (args.firstArgument) {
            // TODO parse as expression
        }
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
        } else if (passageProp !== undefined) {
            const m = /^(['"])(.*)\1$/.exec(passageProp[1].text);
            if (m !== null) {
                const content = m[2];
                parsePassageReference(
                    content,
                    passageProp[1].at + 1,
                    state,
                    chapbookState
                );
            }
        } else {
            logErrorFor(
                args.name.text,
                args.name.at,
                'Either the "passage" or "text" property must be defined',
                state
            );
        }
    },
};
