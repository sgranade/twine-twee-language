import { Definition, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { getAssignmentLocations } from "../assignments";
import { getChapbookDefinitions } from "./chapbook-parser";
import {
    isDisqualifiedConditionalAt,
    variableKinds,
} from "./chapbook-references";
import { OChapbookSymbolKind } from "./types";

export function getDefinitionAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
): Definition | undefined {
    // The index will find all regular definitions and references.
    // It won't work for custom inserts and modifiers, however, as they're
    // matched through a regex test, or for story variables, whose
    // definition is every assignment to them.

    const ref = index.getAllReferencesAt(document.uri, position);
    if (ref === undefined) return undefined;

    if (variableKinds.includes(ref.kind)) {
        if (isDisqualifiedConditionalAt(document.uri, position, index))
            return undefined;
        return getAssignmentLocations(
            index,
            OChapbookSymbolKind.VariableSet,
            ref.contents,
        );
    }

    const definition = getChapbookDefinitions(ref.kind, index).find((def) =>
        def.match.test(ref.contents),
    );
    return definition?.location;
}
