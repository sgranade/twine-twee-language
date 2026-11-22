import { Definition, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { getAssignmentLocations } from "../assignments";
import { OSugarCubeSymbolKind } from "./types";

export function getDefinitionAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
): Definition | undefined {
    // The definition of a SugarCube story variable is "everywhere it's assigned to"
    const ref = index.getAllReferencesAt(document.uri, position);
    if (
        ref?.kind !== OSugarCubeSymbolKind.Variable &&
        ref?.kind !== OSugarCubeSymbolKind.VariableSet
    )
        return undefined;

    return getAssignmentLocations(
        index,
        OSugarCubeSymbolKind.VariableSet,
        ref.contents,
    );
}
