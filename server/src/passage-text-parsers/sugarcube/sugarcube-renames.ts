import { DocumentUri, Position, TextEdit } from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { getReferencesToSymbolAt } from "./sugarcube-references";
import { OSugarCubeSymbolKind } from "./types";

/**
 * Generate renames for a symbol.
 * @param documentUri Document URI.
 * @param position Cursor position.
 * @param newName New name for the symbol.
 * @param index Project index.
 * @returns Generated renames, or undefined if renames aren't possible, or null if we'll let the regular logic handle it.
 */
export function generateRenames(
    documentUri: string,
    position: Position,
    newName: string,
    index: ProjectIndex,
): { [uri: DocumentUri]: TextEdit[] } | undefined | null {
    // Here's the deal: SugarCube has $permanent and _temporary variables.
    // In JavaScript, you get access to them using `State.variables.permanent` and
    // `State.temporary.temporary`. We index both of those, which, great, until it
    // comes time to rename them. We'll handle those renames special so that e.g.
    // renaming `$foo` to `$bar` also changes `State.variables.foo` to
    // `State.variables.var`.
    let origContents: string | undefined;
    let sigilAtRename;
    const ref = index.getReferenceAt(documentUri, position);
    if (ref !== undefined) {
        if (
            ref.kind !== OSugarCubeSymbolKind.Variable &&
            ref.kind !== OSugarCubeSymbolKind.VariableSet
        ) {
            return null; // This isn't a variable, so we don't need to mess w/ it
        } else {
            origContents = ref.contents;
            // The rename shouldn't include a sigil if its location isn't shorter than its contents
            // (e.g. the actual text is part of `State.variables.` w/o a leading `$`)
            sigilAtRename =
                origContents.length ===
                ref.location.range.end.character -
                    ref.location.range.start.character;
        }
    } else {
        const def = index.getDefinitionAt(documentUri, position);
        if (
            def?.kind !== OSugarCubeSymbolKind.Variable &&
            def?.kind !== OSugarCubeSymbolKind.VariableSet
        ) {
            return null;
        }
        origContents = def.contents;
        sigilAtRename =
            origContents.length ===
            def.location.range.end.character -
                def.location.range.start.character;
    }

    // If the original contents don't start w/a sigil, we'll go ahead
    // and let the default rename logic handle it.
    if (origContents[0] !== "$" && origContents[0] !== "_") return null;

    // Get locations of symbols to change
    const locationsToChange = getReferencesToSymbolAt(
        documentUri,
        position,
        index,
        true,
    );
    if (locationsToChange === undefined) {
        return undefined;
    }

    const changes: { [uri: DocumentUri]: TextEdit[] } = {};
    const fullRename = sigilAtRename ? newName : origContents[0] + newName;
    const shortRename = sigilAtRename ? newName.slice(1) : newName;

    for (const location of locationsToChange) {
        const change = TextEdit.replace(
            location.range,
            origContents.length ===
                location.range.end.character - location.range.start.character
                ? fullRename
                : shortRename,
        );
        if (!changes[location.uri]) {
            changes[location.uri] = [];
        }
        changes[location.uri].push(change);
    }

    return changes;
}
