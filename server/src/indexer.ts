import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "./embedded-languages";
import { Passage, ProjectIndex, StoryData } from "./index";
import { ParserCallbacks, parse } from "./parser";
import { Token } from "./tokens";
import { normalizeUri } from "./utilities";

/**
 * Captures information about the current state of indexing
 */
class IndexingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;

    passages: Passage[] = [];
    parseErrors: Diagnostic[] = [];
    tokens: Token[] = [];
    embeddedDocuments: EmbeddedDocument[] = [];

    constructor(textDocument: TextDocument) {
        this.textDocument = textDocument;
    }
}

/**
 * Update project index for a document in that project.
 *
 * @param textDocument Document to index.
 * @param isStartupFile True if the document is the ChoiceScript startup file.
 * @param isChoicescriptStatsFile True if the document is the ChoiceScript stats file.
 * @param index Project index to update.
 */
export function updateProjectIndex(
    textDocument: TextDocument,
    index: ProjectIndex
): void {
    const indexingState = new IndexingState(textDocument);
    const uri = normalizeUri(textDocument.uri);
    index.removeDocument(uri);

    const callbacks: ParserCallbacks = {
        onPassage: function (passage: Passage, contents: string): void {
            indexingState.passages.push(passage);
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
        onToken: function (token: Token): void {
            indexingState.tokens.push(token);
        },
        onParseError: function (error: Diagnostic): void {
            indexingState.parseErrors.push(error);
        },
    };

    parse(textDocument, index.getStoryData()?.storyFormat, callbacks);

    index.setPassages(uri, indexingState.passages);
    index.setEmbeddedDocuments(uri, indexingState.embeddedDocuments);
    index.setTokens(uri, indexingState.tokens);
    index.setParseErrors(uri, indexingState.parseErrors);
}
