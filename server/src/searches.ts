import { Position, TextEdit, WorkspaceEdit } from "vscode-languageserver";

import { ProjectIndex } from "./project-index";

/**
 * Generate renames for a symbol.
 * @param uri Document URI.
 * @param position Cursor position.
 * @param newName New name for the symbol.
 * @param index Project index.
 */
export function generateRenames(
    uri: string,
    position: Position,
    newName: string,
    index: ProjectIndex
): WorkspaceEdit | null {
    const referencesToChange = index.getReferencesAt(uri, position, true);
    if (referencesToChange === undefined) {
        return null;
    }

    const changes: Map<string, TextEdit[]> = new Map();

    for (const location of referencesToChange.locations) {
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
