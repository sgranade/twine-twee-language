import {
    DocumentSymbol,
    FoldingRange,
    SemanticTokens,
    SemanticTokensBuilder,
    SymbolKind,
} from "vscode-languageserver";

import { ProjectIndex } from "./project-index";

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
    const passages = projectIndex.getPassages(uri);
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
    const passages = projectIndex.getPassages(uri);
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
    const builder = new SemanticTokensBuilder();

    for (const {
        line,
        char,
        length,
        tokenType,
        tokenModifiers,
    } of projectIndex.getTokens(uri)) {
        let modifier = 0;
        for (const m of tokenModifiers) {
            modifier |= m;
        }
        builder.push(line, char, length, tokenType, modifier);
    }

    return builder.build();
}
