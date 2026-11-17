import { Location, Position } from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { OChapbookSymbolKind } from "./types";

// Kinds whose references all refer to the same thing
const linkedKindGroups: number[][] = [
    [
        OChapbookSymbolKind.Variable,
        OChapbookSymbolKind.VariableSet,
        OChapbookSymbolKind.ConditionalReference,
    ],
    [OChapbookSymbolKind.Property, OChapbookSymbolKind.PropertySet],
];

/**
 * Get a predicate that says whether a conditional reference (a bare name in
 * script code) to a variable currently counts as a reference to it.
 *
 * @param index Project index.
 * @returns Predicate taking a variable's name.
 */
export function conditionalReferenceQualifier(
    index: ProjectIndex,
): (name: string) => boolean {
    // It's only a reference if it's not been bound by a root declaration
    // in a story script file or `script` passage
    //
    // I'm doing this at query time so we don't have to re-parse other files when
    // one changes
    const defined = new Set<string>();
    const declared = new Set<string>();
    for (const uri of index.getIndexedUris()) {
        for (const ref of index.getReferences(
            uri,
            OChapbookSymbolKind.VariableSet,
        ) ?? [])
            defined.add(ref.contents);
        for (const ref of index.getReferences(
            uri,
            OChapbookSymbolKind.RootDeclaration,
        ) ?? [])
            declared.add(ref.contents);
    }
    return (name) => defined.has(name) && !declared.has(name);
}

/**
 * Is the symbol at a position a conditional reference that doesn't currently
 * count as a reference?
 */
export function isDisqualifiedConditionalAt(
    documentUri: string,
    position: Position,
    index: ProjectIndex,
    qualifies?: (name: string) => boolean,
): boolean {
    const ref = index.getAllReferencesAt(documentUri, position);
    if (ref?.kind !== OChapbookSymbolKind.ConditionalReference) return false;
    return !(qualifies ?? conditionalReferenceQualifier(index))(ref.contents);
}

export function getReferencesToSymbolAt(
    documentUri: string,
    position: Position,
    index: ProjectIndex,
    includeDeclaration: boolean,
): Location[] | undefined {
    const qualifies = conditionalReferenceQualifier(index);
    if (isDisqualifiedConditionalAt(documentUri, position, index, qualifies)) {
        return undefined;
    }

    // Because we track variable references separately from variable-being-set locations,
    // when getting references to one of those (like a variable), we have to add in
    // the locations of the other (where that variable is set in a Chapbook vars section).
    const refs = index.getReferencesToSymbolAt(
        documentUri,
        position,
        includeDeclaration,
    );
    const kind = refs?.kind;
    if (refs === undefined || kind === undefined) return refs?.locations;

    // Variable-ish references are all references to one variable, and so is
    // any conditional reference that qualifies
    const otherKinds = (
        linkedKindGroups.find((group) => group.includes(kind)) ?? []
    ).filter((k) => k !== kind);
    if (otherKinds.length === 0) return refs.locations;

    const locations: Location[] = refs.locations;
    for (const uri of index.getIndexedUris()) {
        for (const otherKind of otherKinds) {
            if (
                otherKind === OChapbookSymbolKind.ConditionalReference &&
                !qualifies(refs.contents)
            )
                continue;
            for (const otherRef of index.getReferences(uri, otherKind) ?? []) {
                if (otherRef.contents === refs.contents)
                    locations.push(...otherRef.locations);
            }
        }
    }

    return locations;
}
