import { Location, Position } from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { OChapbookSymbolKind } from "./types";

export function getReferencesToSymbolAt(
    documentUri: string,
    position: Position,
    index: ProjectIndex
): Location[] | undefined {
    // Because we track variable references separately from variable-being-set locations,
    // when getting references to one of those (like a variable), we have to add in
    // the locations of the other (where that variable is set in a Chapbook vars section).
    const ref = index.getReferencesAt(documentUri, position);
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
        for (const otherRef of index.getReferences(uri, otherKind) ?? []) {
            if (otherRef.contents === ref.contents)
                locations.push(...otherRef.locations);
        }
    }

    return locations;
}
