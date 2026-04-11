import { Location, Position } from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { OChapbookSymbolKind } from "./types";

const linkedTypes = {
    [OChapbookSymbolKind.Variable]: OChapbookSymbolKind.VariableSet,
    [OChapbookSymbolKind.VariableSet]: OChapbookSymbolKind.Variable,
    [OChapbookSymbolKind.Property]: OChapbookSymbolKind.PropertySet,
    [OChapbookSymbolKind.PropertySet]: OChapbookSymbolKind.Property,
};

export function getReferencesToSymbolAt(
    documentUri: string,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean
): Location[] | undefined {
    // Because we track variable references separately from variable-being-set locations,
    // when getting references to one of those (like a variable), we have to add in
    // the locations of the other (where that variable is set in a Chapbook vars section).
    const refs = index.getReferencesToSymbolAt(
        documentUri,
        position,
        includeDeclaration
    );
    const kind = refs?.kind;
    if (
        refs === undefined ||
        kind === undefined ||
        !Object.keys(linkedTypes).includes(kind.toString())
    )
        return refs?.locations;

    const otherKind = linkedTypes[kind];
    const locations: Location[] = refs.locations;
    for (const uri of index.getIndexedUris()) {
        for (const otherRef of index.getReferences(uri, otherKind) ?? []) {
            if (otherRef.contents === refs.contents)
                locations.push(...otherRef.locations);
        }
    }

    return locations;
}
