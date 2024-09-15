import { ArgumentRequirement } from "../../../../passage-text-parsers/chapbook/types";
import {
    InsertInfo,
    InsertTokens,
} from "../../../../passage-text-parsers/chapbook/inserts";

export function buildInsertInfo({
    name = "Mock Insert",
    description = "Description",
    match = /^mock insert/,
    firstArgRequired = ArgumentRequirement.optional,
    requiredProps = {},
    optionalProps = {},
}): InsertInfo {
    return {
        name: name,
        description: description,
        match: match,
        firstArgument: { required: firstArgRequired },
        requiredProps: requiredProps,
        optionalProps: optionalProps,
        completions: [],
        parse: () => {},
    };
}

export function buildInsertTokens({
    name = "insert name",
    nameAt = 1,
    firstArgument = "'first arg'",
    firstArgumentAt = 14,
}): InsertTokens {
    return {
        name: {
            text: name,
            at: nameAt,
        },
        firstArgument: {
            text: firstArgument,
            at: firstArgumentAt,
        },
        props: {},
    };
}
