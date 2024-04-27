import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Passage, ProjectIndex, StoryData } from "./index";
import { ParserCallbacks, parse } from "./parser";
import { normalizeUri } from "./utilities";

/**
 * Captures information about the current state of indexing
 */
class IndexingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;

    passages: Array<Passage> = [];
    parseErrors: Array<Diagnostic> = [];

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
            }
            index.setStoryTitle(uri, title);
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
            }
            index.setStoryData(uri, data);
        },
        onParseError: function (error: Diagnostic): void {
            indexingState.parseErrors.push(error);
        },
    };

    parse(textDocument, callbacks);

    index.setPassages(uri, indexingState.passages);
    index.setParseErrors(uri, indexingState.parseErrors);
}
