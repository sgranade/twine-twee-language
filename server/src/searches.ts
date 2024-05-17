import { Location, Position } from "vscode-languageserver";

import { ProjectIndex } from "./index";
import { positionInRange } from "./utilities";

/**
 * Find where a symbol at a position is defined in the project.
 * @param uri Document URI.
 * @param position Position in the document.
 * @param index Project index.
 * @returns Location of the symbol, or undefined if not found.
 */
export function findDefinitions(
    uri: string,
    position: Position,
    index: ProjectIndex
): Location | undefined {
    let definition: Location | undefined = undefined;

    // See if we have a passage reference at this location
    const references = index.getPassageReferences(uri);
    for (const [name, locations] of Object.entries(references || {})) {
        const match = locations.find((location) => {
            return positionInRange(position, location);
        });
        if (match !== undefined) {
            const passage = index.getPassageByName(name);
            if (passage !== undefined) {
                definition = passage.name.location;
            }

            return definition; // Found or not, we had a reference match, so return
        }
    }
    return definition;
}
