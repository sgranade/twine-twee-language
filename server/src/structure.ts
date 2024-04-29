import { DocumentSymbol, SymbolKind } from "vscode-languageserver";

import { ProjectIndex } from "./index";
import { normalizeUri } from "./utilities";

/**
 * Generate symbols for an index.
 *
 * @param uri URI of the file to generate symbols for.
 * @param projectIndex Project's index.
 * @returns Symbols for that file, or null if the file isn't in the index.
 */
export function generateSymbols(
    uri: string,
    projectIndex: ProjectIndex
): DocumentSymbol[] | null {
    const normalizedUri = normalizeUri(uri);

    const passages = projectIndex.getPassages(normalizedUri);
    if (passages === undefined) {
        return null;
    }
    const info = passages.map((passage) => {
        return DocumentSymbol.create(
            passage.name.label,
            undefined,
            SymbolKind.Namespace,
            passage.name.location.range,
            passage.name.location.range
        );
    });

    return info;
}
