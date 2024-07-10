import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "./embedded-languages";
import {
    Passage,
    ProjectIndex,
    References,
    StoryData,
    Symbol,
    TwineSymbolKind,
} from "./project-index";
import { ParserCallbacks, parse } from "./parser";
import { DiagnosticsOptions } from "./server-options";
import { SemanticToken } from "./tokens";

/**
 * Captures information about the current state of indexing
 */
class IndexingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;

    passages: Passage[] = [];
    definitions: Symbol[] = [];
    references: Symbol[] = [];
    parseErrors: Diagnostic[] = [];
    semanticTokens: SemanticToken[] = [];
    embeddedDocuments: EmbeddedDocument[] = [];

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
 * @param parsePassageContents Whether to parse passage contents.
 * @param index Project index to update.
 * @param diagnosticsOptions Options for what optional diagnostics to report
 */
export function updateProjectIndex(
    textDocument: TextDocument,
    parsePassageContents: boolean,
    index: ProjectIndex,
    diagnosticsOptions?: DiagnosticsOptions
): void {
    const indexingState = new IndexingState(textDocument);
    const uri = textDocument.uri;
    index.removeDocument(uri);

    const callbacks: ParserCallbacks = {
        onPassage: function (passage: Passage): void {
            indexingState.passages.push(passage);
        },
        onSymbolDefinition: function (symbol: Symbol): void {
            indexingState.definitions.push(symbol);
        },
        onSymbolReference: function (symbol: Symbol): void {
            indexingState.references.push(symbol);
        },
        onStoryTitle: function (title: string, range: Range): void {
            if (index.getStoryTitle() !== undefined) {
                this.onParseError(
                    Diagnostic.create(
                        range,
                        "This replaces an existing StoryTitle. Is that intentional?",
                        DiagnosticSeverity.Warning
                    )
                );
            } else {
                index.setStoryTitle(title, uri);
            }
        },
        onStoryData: function (data: StoryData, range: Range): void {
            if (index.getStoryData() !== undefined) {
                this.onParseError(
                    Diagnostic.create(
                        range,
                        "This replaces existing StoryData. Is that intentional?",
                        DiagnosticSeverity.Warning
                    )
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
        onParseError: function (error: Diagnostic): void {
            indexingState.parseErrors.push(error);
        },
    };

    parse(
        textDocument,
        callbacks,
        parsePassageContents,
        index.getStoryData()?.storyFormat,
        diagnosticsOptions
    );

    // Collate the array of individual references by name
    const referencesMap: Record<string, References> = {};
    for (const symbol of indexingState.references) {
        const ref = referencesMap[symbol.contents] || {
            contents: symbol.contents,
            locations: [],
            kind: symbol.kind,
        };
        ref.locations.push(symbol.location);
        referencesMap[symbol.contents] = ref;
    }
    const references = Object.values(referencesMap);

    index.setPassages(uri, indexingState.passages);
    index.setDefinitions(uri, indexingState.definitions);
    index.setReferences(uri, references);
    index.setEmbeddedDocuments(uri, indexingState.embeddedDocuments);
    index.setSemanticTokens(uri, indexingState.semanticTokens);
    index.setParseErrors(uri, indexingState.parseErrors);
}
