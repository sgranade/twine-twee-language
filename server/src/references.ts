import { Location, Position } from "vscode-languageserver";

import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";

export function getReferencesToSymbolAt(
    uri: string,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean,
): Location[] | undefined {
    let refLocations: Location[] | undefined | null = null;

    // Check the story format's references, followed by the default index
    // Note that the story parser's function can return locations, undefined (not found),
    // or null (not implemented).
    const parser = getStoryFormatParser(index.getStoryData()?.storyFormat);
    if (parser) {
        refLocations = parser.getReferencesToSymbolAt(
            uri,
            position,
            index,
            includeDeclaration,
        );
    }
    // If refLocations is null, either the parser doesn't exist or doesn't have
    // an implementation.
    if (refLocations === null) {
        refLocations = index.getReferencesToSymbolAt(
            uri,
            position,
            includeDeclaration,
        )?.locations;
    }

    return refLocations ? [...refLocations] : undefined;
}
