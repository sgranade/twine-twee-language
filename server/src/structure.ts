import {
    DocumentSymbol,
    FoldingRange,
    SymbolKind,
} from "vscode-languageserver";

import { ProjectIndex } from "./index";
import { normalizeUri } from "./utilities";

/**
 * Generate symbols for a document.
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
            SymbolKind.Class,
            passage.name.scope || passage.name.location.range,
            passage.name.location.range
        );
    });

    return info;
}

/**
 * Generate folding ranges for a document.
 *
 * @param uri URI fo the file to generate folding ranges for.
 * @param projectIndex Project's index.
 * @returns Folding ranges for that file, or null if the file isn't in the index.
 */
export function generateFoldingRanges(
    uri: string,
    projectIndex: ProjectIndex
): FoldingRange[] | null {
    const normalizedUri = normalizeUri(uri);
    const passages = projectIndex.getPassages(normalizedUri);
    if (passages === undefined) {
        return null;
    }
    const ranges = passages.map((passage) => {
        return FoldingRange.create(
            passage.name.scope?.start.line ||
                passage.name.location.range.start.line,
            passage.name.scope?.end.line || passage.name.location.range.end.line
        );
    });

    return ranges;
}
