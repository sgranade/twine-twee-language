import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DecorationRange } from "./client-server";
import {
    createDiagnosticFromRange,
    DiagnosticCode,
    DiagnosticCodes,
    DiagnosticMap,
} from "./diagnostics";
import { EmbeddedDocument } from "./embedded-languages";
import { ParseLevel, ParserCallbacks, parse } from "./parser";
import {
    Passage,
    ProjectIndex,
    ProjSymbol,
    References,
    StoryData,
} from "./project-index";
import { SemanticToken } from "./semantic-tokens";

/**
 * Captures information about the current state of indexing
 */
class IndexingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;

    passages: Passage[] = [];
    definitions: ProjSymbol[] = [];
    references: ProjSymbol[] = [];
    parseErrors: Diagnostic[] = [];
    semanticTokens: SemanticToken[] = [];
    foldingRanges: Range[] = [];
    decorationRanges: DecorationRange[] = [];
    embeddedDocuments: EmbeddedDocument[] = [];
    disabledDiagnosticsRanges: DiagnosticMap<Range[]> = {};

    constructor(textDocument: TextDocument) {
        this.textDocument = textDocument;
    }
}

/**
 * Update a project index for a document in that project.
 *
 * Passage content parsing is optional so that documents can be quickly parsed
 * to build an initial index of passage names. Even if passage content parsing
 * is skipped, though, the StoryTitle and StoryData passages are still parsed.
 *
 * @param textDocument Document to index.
 * @param parseLevel Level of parsing to do.
 * @param index Project index to update.
 */
export function updateProjectIndex(
    textDocument: TextDocument,
    parseLevel: ParseLevel,
    index: ProjectIndex,
): void {
    const indexingState = new IndexingState(textDocument);
    const uri = textDocument.uri;
    index.removeDocument(uri);

    const callbacks: ParserCallbacks = {
        onPassage: function (passage: Passage): void {
            indexingState.passages.push(passage);
        },
        onSymbolDefinition: function (symbol: ProjSymbol): void {
            indexingState.definitions.push(symbol);
        },
        onSymbolReference: function (symbol: ProjSymbol): void {
            indexingState.references.push(symbol);
        },
        onStoryTitle: function (title: string, range: Range): void {
            if (index.getStoryTitle() !== undefined) {
                this.onParseError(
                    createDiagnosticFromRange(
                        DiagnosticCodes.ReplacesStoryTitle,
                        range,
                    ),
                );
            } else {
                index.setStoryTitle(title, uri);
            }
        },
        onStoryData: function (data: StoryData, range: Range): void {
            if (index.getStoryData() !== undefined) {
                this.onParseError(
                    createDiagnosticFromRange(
                        DiagnosticCodes.ReplacesStoryData,
                        range,
                    ),
                );
            } else {
                index.setStoryData(data, uri);
            }
        },
        onEmbeddedDocument: function (document: EmbeddedDocument): void {
            indexingState.embeddedDocuments.push(document);
        },
        onSemanticToken: function (token: SemanticToken): void {
            indexingState.semanticTokens.push(token);
        },
        onFoldingRange: function (range: Range): void {
            indexingState.foldingRanges.push(range);
        },
        onDecorationRange: function (range: DecorationRange): void {
            indexingState.decorationRanges.push(range);
        },
        onParseError: function (error: Diagnostic): void {
            indexingState.parseErrors.push(error);
        },
        onDisabledDiagnosticRange: function (
            code: DiagnosticCode,
            range: Range,
        ): void {
            const disabledRanges =
                indexingState.disabledDiagnosticsRanges[code] ?? [];
            disabledRanges.push(range);
            indexingState.disabledDiagnosticsRanges[code] = disabledRanges;
        },
    };

    parse(
        textDocument,
        callbacks,
        parseLevel,
        index.getStoryData()?.storyFormat,
    );

    // Collate the array of individual references by kind and name
    const referencesMap: Record<string, References> = {};
    for (const symbol of indexingState.references) {
        const key = `${symbol.kind},${symbol.contents}`;
        const ref = referencesMap[key] || {
            contents: symbol.contents,
            locations: [],
            kind: symbol.kind,
        };
        ref.locations.push(symbol.location);
        referencesMap[key] = ref;
    }
    const references = Object.values(referencesMap);

    index.setPassages(uri, indexingState.passages);
    index.setDefinitions(uri, indexingState.definitions);
    index.setReferences(uri, references);
    index.setEmbeddedDocuments(uri, indexingState.embeddedDocuments);
    index.setSemanticTokens(uri, indexingState.semanticTokens);
    index.setFoldingRanges(uri, indexingState.foldingRanges);
    index.setDecorationRanges(uri, indexingState.decorationRanges);
    index.setParseErrors(uri, indexingState.parseErrors);
    index.setDisabledDiagnosticRanges(
        uri,
        indexingState.disabledDiagnosticsRanges,
    );
}
