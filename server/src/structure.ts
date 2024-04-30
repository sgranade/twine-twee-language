import {
    DocumentSymbol,
    FoldingRange,
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensLegend,
    SymbolKind,
} from "vscode-languageserver";

import { ProjectIndex } from "./index";
import { normalizeUri } from "./utilities";

export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: ["class"],
    tokenModifiers: [],
};

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
    const info = [];
    for (const passage of passages) {
        if (passage.name.label) {
            info.push(
                DocumentSymbol.create(
                    passage.name.label,
                    undefined,
                    SymbolKind.Class,
                    passage.name.scope || passage.name.location.range,
                    passage.name.location.range
                )
            );
        }
    }

    return info;
}

/**
 * Generate folding ranges for a document.
 *
 * @param uri URI of the file to generate folding ranges for.
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

/**
 * Generate semantic tokens for a document.
 *
 * @param uri URI of the file to generate semantic tokens for.
 * @param projectIndex Project's index.
 * @returns Semantic tokens.
 */
export function generateSemanticTokens(
    uri: string,
    projectIndex: ProjectIndex
): SemanticTokens {
    const normalizedUri = normalizeUri(uri);
    const builder = new SemanticTokensBuilder();

    const passages = projectIndex.getPassages(normalizedUri);
    if (passages !== undefined) {
        for (const passage of passages) {
            builder.push(
                passage.name.location.range.start.line,
                passage.name.location.range.start.character,
                passage.name.label.length,
                0,
                0
            );
        }
    }

    return builder.build();
}
