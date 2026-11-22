import {
    DocumentUri,
    Location,
    Position,
    TextEdit,
} from "vscode-languageserver";

import { ProjectIndex } from "../../project-index";
import { isIdentifierName, isReservedWord } from "../../script-analysis";
import {
    RenameRefusal,
    refuseInvalidPropertyName,
    refuseRename,
} from "../types";
import {
    getReferencesToSymbolAt,
    isDisqualifiedConditionalAt,
} from "./chapbook-references";
import { whatExcludedBareNameIs } from "./chapbook-script-symbols";
import { OChapbookSymbolKind } from "./types";

const variableKinds: readonly number[] = [
    OChapbookSymbolKind.Variable,
    OChapbookSymbolKind.VariableSet,
    OChapbookSymbolKind.ConditionalReference,
];
const propertyKinds: readonly number[] = [
    OChapbookSymbolKind.Property,
    OChapbookSymbolKind.PropertySet,
];

/**
 * Find a root-level declaration of a name that a bare name in a document
 * would resolve to: its own declarations for an included script, or the
 * shared script scope's for everything else.
 */
function findVisibleDeclaration(
    name: string,
    uri: string,
    index: ProjectIndex,
): Location | undefined {
    const ownScope = index.getScriptFileRole(uri) === "included-script";
    return index
        .getProjectReferences([OChapbookSymbolKind.RootDeclaration], (u) =>
            ownScope
                ? u === uri
                : index.getScriptFileRole(u) !== "included-script",
        )
        .find((ref) => ref.contents === name)?.locations[0];
}

/**
 * Describe the Twee passage or file where a location is.
 */
function describeLocationPassageOrFile(
    location: Location,
    index: ProjectIndex,
) {
    const passage = index.getPassageAt(location.uri, location.range.start);
    return passage !== undefined
        ? `the \`${passage.name.contents}\` passage in ${location.uri}`
        : location.uri;
}

/**
 * Can the symbol at a position be renamed?
 *
 * @param documentUri Document URI.
 * @param position Cursor position.
 * @param index Project index.
 */
export function isRenamableAt(
    documentUri: string,
    position: Position,
    index: ProjectIndex,
): boolean {
    // Declarations are never story variables, and a conditional reference
    // that doesn't currently count isn't actually a reference.
    return (
        index.getAllReferencesAt(documentUri, position)?.kind !==
            OChapbookSymbolKind.RootDeclaration &&
        !isDisqualifiedConditionalAt(documentUri, position, index)
    );
}

/**
 * Generate renames for a Chapbook symbol.
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
    // Make sure we can rename the symbol
    if (!isRenamableAt(documentUri, position, index)) return undefined;
    const symbol =
        index.getAllReferencesAt(documentUri, position) ??
        index.getDefinitionAt(documentUri, position);
    if (symbol === undefined) return null;
    if (propertyKinds.includes(symbol.kind)) {
        // Let regular rename logic take care of it as long as the new name's valid
        return refuseInvalidPropertyName(symbol.contents, newName) ?? null;
    }
    if (!variableKinds.includes(symbol.kind)) return null;

    const cantRename = `Can't rename \`${symbol.contents}\` to \`${newName}\``;
    if (!isIdentifierName(newName)) {
        return refuseRename(
            `${cantRename}: ${newName} isn't a valid JavaScript identifier.`,
        );
    }

    const locations = getReferencesToSymbolAt(
        documentUri,
        position,
        index,
        true,
    );
    if (locations === undefined) return undefined;

    const conditionalReferences = locations.filter(
        (loc) =>
            index.getAllReferencesAt(loc.uri, loc.range.start)?.kind ===
            OChapbookSymbolKind.ConditionalReference,
    );
    if (conditionalReferences.length > 0) {
        if (isReservedWord(newName)) {
            return refuseRename(
                `${cantRename}: \`${newName}\` is a JavaScript reserved word, and script code uses the variable's bare name.`,
            );
        }
        const excluded = whatExcludedBareNameIs(newName);
        if (excluded !== undefined) {
            return refuseRename(
                `${cantRename}: \`${newName}\` is ${excluded}, so script code that uses the variable's bare name would no longer refer to the story variable.`,
            );
        }
        for (const reference of conditionalReferences) {
            const declaration = findVisibleDeclaration(
                newName,
                reference.uri,
                index,
            );
            if (declaration !== undefined) {
                return refuseRename(
                    `${cantRename}: \`${newName}\` is declared at the root of ${describeLocationPassageOrFile(declaration, index)}, so script code that uses the variable's bare name would refer to that declaration instead of the story variable.`,
                );
            }
        }
    }

    const changes: { [uri: DocumentUri]: TextEdit[] } = {};
    for (const location of locations) {
        (changes[location.uri] ??= []).push(
            TextEdit.replace(location.range, newName),
        );
    }
    return changes;
}
