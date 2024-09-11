import { Location, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";

export function getReferencesToSymbolAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean
): Location[] | undefined {
    // First: check the index
    const indexReferences = index.getReferencesToSymbolAt(
        document.uri,
        position,
        includeDeclaration
    );

    // Second: check the story format
    const formatReferences = getStoryFormatParser(
        index.getStoryData()?.storyFormat
    )?.getReferencesToSymbolAt(document, position, index, includeDeclaration);

    if (indexReferences === undefined && formatReferences === undefined)
        return undefined;

    return [...(indexReferences?.locations || []), ...(formatReferences || [])];
}
