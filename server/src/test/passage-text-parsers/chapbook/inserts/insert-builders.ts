import {
    InsertParser,
    InsertTokens,
} from "../../../../passage-text-parsers/chapbook/inserts";

export function buildInsertParser({
    name = "Mock Insert",
    match = /^mock insert/,
    firstArgRequired = false,
    requiredProps = {},
    optionalProps = {},
}): InsertParser {
    return {
        name: name,
        match: match,
        arguments: {
            firstArgument: firstArgRequired,
            requiredProps: requiredProps,
            optionalProps: optionalProps,
        },
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
