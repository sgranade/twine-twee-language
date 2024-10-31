import { Location, Position } from "vscode-languageserver";

import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";

export function getReferencesToSymbolAt(
    uri: string,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean
): Location[] | undefined {
    // First: check the index
    const indexReferences = index.getReferencesToSymbolAt(
        uri,
        position,
        includeDeclaration
    );

    // Second: check the story format
    const formatReferences = getStoryFormatParser(
        index.getStoryData()?.storyFormat
    )?.getReferencesToSymbolAt(uri, position, index, includeDeclaration);

    if (indexReferences === undefined && formatReferences === undefined)
        return undefined;

    return [...(indexReferences?.locations ?? []), ...(formatReferences ?? [])];
}
