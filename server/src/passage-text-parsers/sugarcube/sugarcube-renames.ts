import {
    DocumentUri,
    Location,
    Position,
    TextEdit,
} from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { isIdentifierName } from "../../script-analysis";
import {
    RenameRefusal,
    refuseInvalidPropertyName,
    refuseRename,
} from "../types";
import { getReferencesToSymbolAt } from "./sugarcube-references";
import { OSugarCubeSymbolKind } from "./types";

const variableKinds: readonly number[] = [
    OSugarCubeSymbolKind.Variable,
    OSugarCubeSymbolKind.VariableSet,
];
const propertyKinds: readonly number[] = [
    OSugarCubeSymbolKind.Property,
    OSugarCubeSymbolKind.PropertySet,
];

/**
 * Generate renames for a SugarCube symbol.
 *
 * @param documentUri Document URI.
 * @param position Cursor position.
 * @param newName New name for the symbol.
 * @param index Project index.
 * @returns Generated renames, undefined if renames aren't possible, a refusal if the new name can't be right, or null if we'll let the regular logic handle it.
 */
export function generateRenames(
    documentUri: string,
    position: Position,
    newName: string,
    index: ProjectIndex,
): { [uri: DocumentUri]: TextEdit[] } | RenameRefusal | undefined | null {
    // Here's the deal: SugarCube has $permanent and _temporary variables.
    // In JavaScript, you get access to them using `State.variables.permanent` and
    // `State.temporary.temporary`. We index both of those, which, great, until it
    // comes time to rename them. We'll handle those renames special so that e.g.
    // renaming `$foo` to `$bar` also changes `State.variables.foo` to
    // `State.variables.var`.
    const symbol =
        index.getReferenceAt(documentUri, position) ??
        index.getDefinitionAt(documentUri, position);
    if (symbol === undefined) return null;
    if (propertyKinds.includes(symbol.kind)) {
        // Let regular rename logic take care of it as long as the new name's valid
        return refuseInvalidPropertyName(symbol.contents, newName) ?? null;
    }
    if (!variableKinds.includes(symbol.kind)) {
        return null; // This isn't a variable, so we don't need to mess w/ it
    }
    const origContents = symbol.contents;

    // If the original contents don't start w/a sigil, we'll go ahead
    // and let the default rename logic handle it.
    if (origContents[0] !== "$" && origContents[0] !== "_") return null;

    // An omitted sigil means the original one
    const sigil = origContents[0];
    let name = newName;
    if (newName[0] === "$" || newName[0] === "_") {
        if (newName[0] !== sigil) {
            return refuseRename(
                `Can't rename \`${origContents}\` to \`${newName}\`: we don't support swapping between \`$\` story variables and \`_\` temporary variables.`,
            );
        }
        name = newName.slice(1);
    }
    if (!isIdentifierName(name)) {
        return refuseRename(
            `Can't rename \`${origContents}\` to \`${sigil}${name}\`: \`${name}\` isn't a valid JavaScript identifier.`,
        );
    }

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
    const symbolAt = (location: Location) =>
        index.getReferenceAt(location.uri, location.range.start) ??
        index.getDefinitionAt(location.uri, location.range.start);

    for (const location of locationsToChange) {
        const symbol = symbolAt(location);
        let replacement = symbol?.sigilOutsideRange ? name : sigil + name;
        // Keep a shorthand destructuring's local binding (e.g. `{ old }` -> `{ new: old }`)
        if (symbol?.shorthand) replacement += `: ${origContents.slice(1)}`;
        const change = TextEdit.replace(location.range, replacement);
        if (!changes[location.uri]) {
            changes[location.uri] = [];
        }
        changes[location.uri].push(change);
    }

    return changes;
}
