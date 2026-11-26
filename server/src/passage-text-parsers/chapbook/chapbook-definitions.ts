import { Definition, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { getAssignmentLocations } from "../assignments";
import { getChapbookDefinitions } from "./chapbook-parser";
import { isDisqualifiedConditionalAt } from "./chapbook-references";
import { OChapbookSymbolKind } from "./types";

// Which kind of assignment defines each kind of reference
const assignmentKinds: Record<number, number> = {
    [OChapbookSymbolKind.Variable]: OChapbookSymbolKind.VariableSet,
    [OChapbookSymbolKind.VariableSet]: OChapbookSymbolKind.VariableSet,
    [OChapbookSymbolKind.ConditionalReference]: OChapbookSymbolKind.VariableSet,
    [OChapbookSymbolKind.Property]: OChapbookSymbolKind.PropertySet,
    [OChapbookSymbolKind.PropertySet]: OChapbookSymbolKind.PropertySet,
};

export function getDefinitionAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
): Definition | undefined {
    // The index will find all regular definitions and references.
    // It won't work for custom inserts and modifiers, however, as they're
    // matched through a regex test, or for story variables and propereties,
    // which are found thru their assignments.

    const ref = index.getAllReferencesAt(document.uri, position);
    if (ref === undefined) return undefined;

    // Only conditional references can be disqualified; properties never are
    if (isDisqualifiedConditionalAt(document.uri, position, index))
        return undefined;
    const assignmentKind = assignmentKinds[ref.kind];
    if (assignmentKind !== undefined) {
        return getAssignmentLocations(index, assignmentKind, ref.contents);
    }

    const definition = getChapbookDefinitions(ref.kind, index).find((def) =>
        def.match.test(ref.contents),
    );
    return definition?.location;
}
