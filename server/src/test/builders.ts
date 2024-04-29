import { Range } from "vscode-languageserver";

import { Passage } from "../index";

export function buildPassage({
    label = "Passage",
    location = {
        uri: "fake-uri",
        range: Range.create(1, 1, 2, 2),
    },
    scope = Range.create(3, 3, 4, 4),
    isScript = false,
    isStylesheet = false,
    tags = undefined,
    metadata = undefined,
}): Passage {
    return {
        name: {
            label: label,
            location: location,
            scope: scope,
        },
        isScript: isScript,
        isStylesheet: isStylesheet,
        tags: tags,
        metadata: metadata,
    };
}
