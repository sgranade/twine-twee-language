import { Location, Position } from "vscode-languageserver";

import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";

export function getReferencesToSymbolAt(
    uri: string,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean
): Location[] | undefined {
    // Check the story format's references, followed by the default index
    const refLocations =
        getStoryFormatParser(
            index.getStoryData()?.storyFormat
        )?.getReferencesToSymbolAt(uri, position, index, includeDeclaration) ||
        index.getReferencesToSymbolAt(uri, position, includeDeclaration)
            ?.locations;

    if (refLocations === undefined) return undefined;

    return [...(refLocations ?? [])];
}
