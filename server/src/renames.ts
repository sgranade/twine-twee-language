import {
    DocumentUri,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    ResponseError,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit,
} from "vscode-languageserver";

import { getStoryFormatParser } from "./passage-text-parsers";
import { RenameRefusal } from "./passage-text-parsers/types";
import { ProjectIndex } from "./project-index";
import { getReferencesToSymbolAt } from "./references";
import { positionInRange } from "./utilities";

/**
 * Prepare for a rename request by seeing if a renamable symbol is at the location.
 * @param uri Document URI.
 * @param position Cursor position.
 * @param index Project index.
 * @param getParser Function tog et a story-format-specific parser.
 * @returns Range of the symbol being renamed, or undefined if no rename is possible at the position.
 */
export function prepareRename(
    uri: string,
    position: Position,
    index: ProjectIndex,
    getParser: typeof getStoryFormatParser = getStoryFormatParser,
): Range | undefined {
    // Make sure the parser will let us rename the symbol (if any) at this location.
    const parser = getParser(index.getStoryData()?.storyFormat);
    if (parser?.isRenamableAt?.(uri, position, index) === false) {
        return undefined;
    }

    // Look for a definition or reference at the current location
    const symbol = index.getDefinitionAt(uri, position);
    if (symbol !== undefined) {
        return symbol.location.range;
    }

    const refs = index.getAllReferencesAt(uri, position);
    if (refs !== undefined) {
        const match = refs.locations.find((loc) =>
            positionInRange(position, loc.range),
        );
        if (match !== undefined) {
            return match.range;
        }
    }

    return undefined;
}

/**
 * How rename edits are sent to the client.
 */
export interface RenameTransport {
    /**
     * True if the client supports versioned `documentChanges`.
     */
    documentChanges: boolean;
    /**
     * Get the synced version of an open document, or null for a closed one.
     */
    versionOf: (uri: DocumentUri) => number | null;
}

/**
 * Turn changes into workspace edits.
 */
function toWorkspaceEdit(
    changes: { [uri: DocumentUri]: TextEdit[] },
    transport: RenameTransport | undefined,
): WorkspaceEdit {
    // If the client supports document changes, we'll send versioned
    // document changes so it can reject a stale rename.
    if (!transport?.documentChanges) return { changes };
    return {
        documentChanges: Object.entries(changes).map(([uri, edits]) =>
            TextDocumentEdit.create(
                OptionalVersionedTextDocumentIdentifier.create(
                    uri,
                    transport.versionOf(uri),
                ),
                edits,
            ),
        ),
    };
}

/**
 * Generate renames for a symbol.
 * @param uri Document URI.
 * @param position Cursor position.
 * @param newName New name for the symbol.
 * @param index Project index.
 * @param getParser Function to get a story-format-specific parser.
 * @param transport How to send the edits (defaults to plain changes if undefined).
 * @returns Generated renames, or null if renames aren't possible.
 */
export function generateRenames(
    uri: string,
    position: Position,
    newName: string,
    index: ProjectIndex,
    getParser: typeof getStoryFormatParser = getStoryFormatParser,
    transport?: RenameTransport,
): WorkspaceEdit | RenameRefusal | null {
    // Check the story format's changes, followed by the default index
    // Note that the story parser's function can return changes, undefined (no change
    // possible), or null (not implemented).
    const parser = getParser(index.getStoryData()?.storyFormat);
    if (parser) {
        const changes = parser.generateRenamesAt(uri, position, newName, index);
        if (changes === undefined) return null;
        if (changes instanceof ResponseError) return changes;
        if (changes !== null) return toWorkspaceEdit(changes, transport);
    }

    // Get locations of symbols to change
    const locationsToChange = getReferencesToSymbolAt(
        uri,
        position,
        index,
        true,
    );
    if (locationsToChange === undefined) {
        return null;
    }

    const changes: { [uri: DocumentUri]: TextEdit[] } = {};

    for (const location of locationsToChange) {
        const change = TextEdit.replace(location.range, newName);
        if (!changes[location.uri]) {
            changes[location.uri] = [];
        }
        changes[location.uri].push(change);
    }

    return toWorkspaceEdit(changes, transport);
}
