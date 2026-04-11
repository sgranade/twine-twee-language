import {
    DocumentSymbol,
    FoldingRange,
    SemanticTokens,
    SemanticTokensBuilder,
    SymbolKind,
} from "vscode-languageserver";

import { ProjectIndex } from "./project-index";
import { DecorationRange } from "./client-server";

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
    const ranges = projectIndex.getFoldingRanges(uri);
    if (ranges.length) {
        return ranges.map((r) => FoldingRange.create(r.start.line, r.end.line));
    } else {
        return null;
    }
}

/**
 * Generate decoration ranges for a document.
 *
 * @param uri URI of the file to generate decoration ranges for.
 * @param projectIndex Project's index.
 * @returns Decoration ranges for that file, or null if the file isn't in the index.
 */
export function generateDecorationRanges(
    uri: string,
    projectIndex: ProjectIndex
): readonly DecorationRange[] {
    return projectIndex.getDecorationRanges(uri);
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
    const builder = new SemanticTokensBuilder();

    for (const {
        line,
        char,
        length,
        tokenType,
        tokenModifiers,
    } of projectIndex.getSemanticTokens(uri)) {
        let modifier = 0;
        for (const m of tokenModifiers) {
            modifier |= m;
        }
        builder.push(line, char, length, tokenType, modifier);
    }

    return builder.build();
}
