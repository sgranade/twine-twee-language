import {
    Position,
    Range,
    TextEdit,
    WorkspaceEdit,
} from "vscode-languageserver";

import { ProjectIndex } from "./project-index";
import { positionInRange } from "./utilities";
import { getReferencesToSymbolAt } from "./passage-text-parsers/chapbook/chapbook-references";

/**
 * Prepare for a rename request by seeing if a renamable symbol is at the location.
 * @param uri Document URI.
 * @param position Cursor position.
 * @param index Project index.
 * @returns Range of the symbol being renamed, or undefined if no rename is possible at the position.
 */
export function prepareRename(
    uri: string,
    position: Position,
    index: ProjectIndex
): Range | undefined {
    // Look for a definition or reference at the current location
    const symbol = index.getDefinitionAt(uri, position);
    if (symbol !== undefined) {
        return symbol.location.range;
    }

    const refs = index.getReferencesAt(uri, position);
    if (refs !== undefined) {
        const match = refs.locations.find((loc) =>
            positionInRange(position, loc.range)
        );
        if (match !== undefined) {
            return match.range;
        }
    }

    return undefined;
}

/**
 * Generate renames for a symbol.
 * @param uri Document URI.
 * @param position Cursor position.
 * @param newName New name for the symbol.
 * @param index Project index.
 * @returns Generated renames, or null if renames aren't possible.
 */
export function generateRenames(
    uri: string,
    position: Position,
    newName: string,
    index: ProjectIndex
): WorkspaceEdit | null {
    // Get locations of symbols to change
    const locationsToChange = getReferencesToSymbolAt(
        uri,
        position,
        index,
        true
    );
    if (locationsToChange === undefined) {
        return null;
    }

    const changes: Map<string, TextEdit[]> = new Map();

    for (const location of locationsToChange) {
        const change = TextEdit.replace(location.range, newName);
        let edits = changes.get(location.uri);
        if (edits === undefined) {
            edits = [];
            changes.set(location.uri, edits);
        }
        edits.push(change);
    }

    const workspaceEdit: WorkspaceEdit = {
        changes: {},
    };
    for (const [uri, edits] of changes) {
        if (workspaceEdit.changes) {
            workspaceEdit.changes[uri] = edits;
        }
    }

    return workspaceEdit;
}
