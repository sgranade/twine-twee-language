import { Location, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { getChapbookDefinitions } from "./chapbook-parser";
import { OChapbookSymbolKind } from "./types";

export function getReferencesToSymbolAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean
): Location[] | undefined {
    // Because we track variable references separately from variable-being-set locations,
    // when getting references to one of those (like a variable), we have to add in
    // the locations of the other (where that variable is set in a Chapbook vars section).
    const ref = index.getReferencesAt(document.uri, position);
    const kind = ref?.kind;
    if (
        ref === undefined ||
        (kind !== OChapbookSymbolKind.Variable &&
            kind !== OChapbookSymbolKind.VariableSet)
    )
        return undefined;

    const otherKind =
        kind === OChapbookSymbolKind.Variable
            ? OChapbookSymbolKind.VariableSet
            : OChapbookSymbolKind.Variable;
    const locations: Location[] = [];
    for (const uri of index.getIndexedUris()) {
        for (const otherRef of index.getReferences(uri, otherKind) || []) {
            if (otherRef.contents === ref.contents)
                locations.push(...otherRef.locations);
        }
    }

    return locations;
}
