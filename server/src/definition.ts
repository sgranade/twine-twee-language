import { Definition, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";

export function getDefinitionAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Definition | undefined {
    // First: check the index
    let definition = index.getDefinitionBySymbolAt(document.uri, position);
    if (definition !== undefined) return definition.location;

    return undefined;
}
