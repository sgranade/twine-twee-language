import {
    DocumentSymbol,
    FoldingRange,
    SemanticTokens,
    SemanticTokensBuilder,
    SemanticTokensLegend,
    SymbolKind,
} from "vscode-languageserver";

import { ETokenType, ProjectIndex } from "./index";
import { normalizeUri } from "./utilities";

export const semanticTokensLegend: SemanticTokensLegend = {
    tokenTypes: Object.keys(ETokenType),
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
        if (passage.name.contents) {
            info.push(
                DocumentSymbol.create(
                    passage.name.contents,
                    undefined,
                    SymbolKind.Class,
                    passage.scope,
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
            passage.scope.start.line || passage.name.location.range.start.line,
            passage.scope.end.line || passage.name.location.range.end.line
        );
    });

    return ranges;
}

const stringRegex = /(?<!\\)"(.*?)(?<!\\)"/g;

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
                passage.name.contents.length,
                ETokenType.class,
                0
            );
            if (passage.tags !== undefined) {
                for (const tag of passage.tags) {
                    builder.push(
                        tag.location.range.start.line,
                        tag.location.range.start.character,
                        tag.contents.length,
                        ETokenType.property,
                        0
                    );
                }
            }
            if (passage.metadata !== undefined) {
                // Do super simple searching rather than parse the underlying JSON
                stringRegex.lastIndex = 0;
                const line = passage.metadata.raw.location.range.start.line;
                const character =
                    passage.metadata.raw.location.range.start.character;
                for (const m of passage.metadata.raw.contents.matchAll(
                    stringRegex
                )) {
                    builder.push(
                        line,
                        character + m.index,
                        m[0].length,
                        ETokenType.string,
                        0
                    );
                }
            }
        }
    }

    return builder.build();
}
