import { ArgumentRequirement, InsertInfo } from "./types";

export const textInput: InsertInfo = {
    name: "text input",
    syntax: "{text input _for: 'variable name', required: false_}",
    description:
        "Renders a text field, saving the text entered to the variable named. `for 'variable name'` can be omitted; Chapbook will not save the selected value anywhere. `required` can also be omitted; Chapbook will make the filed required unless you specify otherwise.",
    match: /^text\s+input(\s+for)?/i,
    arguments: {
        firstArgument: {
            required: ArgumentRequirement.optional,
            placeholder: "'variable name'",
        },
        requiredProps: {},
        optionalProps: { required: "false" },
    },
    completions: ["text input"],
    parse(args, state, chapbookState) {},
};
