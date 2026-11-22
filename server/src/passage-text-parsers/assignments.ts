import { Location } from "vscode-languageserver";

import { ProjectIndex } from "../project-index";

/**
 * Get every location in the project that assigns to a story variable.
 *
 * @param index Project index.
 * @param assignmentKind Story format's symbol kind for an assignment.
 * @param name Story variable's name.
 * @returns Assignment locations, or undefined if there are none.
 */
export function getAssignmentLocations(
    index: ProjectIndex,
    assignmentKind: number,
    name: string,
): Location[] | undefined {
    const locations: Location[] = [];
    for (const uri of index.getIndexedUris()) {
        for (const ref of index.getReferences(uri, assignmentKind) ?? []) {
            if (ref.contents === name) locations.push(...ref.locations);
        }
    }
    return locations.length > 0 ? locations : undefined;
}
