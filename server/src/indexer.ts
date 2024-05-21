import { Diagnostic, DiagnosticSeverity, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "./embedded-languages";
import { Passage, ProjectIndex, StoryData } from "./project-index";
import { ParserCallbacks, parse } from "./parser";
import { Token } from "./tokens";

/**
 * Captures information about the current state of indexing
 */
class IndexingState {
    /**
     * Document being validated
     */
    textDocument: TextDocument;

    passages: Passage[] = [];
    passageReferences: Record<string, Range[]> = {};
    parseErrors: Diagnostic[] = [];
    tokens: Token[] = [];
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
 */
export function updateProjectIndex(
    textDocument: TextDocument,
    parsePassageContents: boolean,
    index: ProjectIndex
): void {
    const indexingState = new IndexingState(textDocument);
    const uri = textDocument.uri;
    index.removeDocument(uri);

    const callbacks: ParserCallbacks = {
        onPassage: function (passage: Passage): void {
            indexingState.passages.push(passage);
        },
        onPassageReference(passageName: string, range: Range): void {
            if (indexingState.passageReferences[passageName] === undefined) {
                indexingState.passageReferences[passageName] = [];
            }
            indexingState.passageReferences[passageName].push(range);
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

    parse(
        textDocument,
        index.getStoryData()?.storyFormat,
        parsePassageContents,
        callbacks
    );

    index.setPassages(uri, indexingState.passages);
    index.setPassageReferences(uri, indexingState.passageReferences);
    index.setEmbeddedDocuments(uri, indexingState.embeddedDocuments);
    index.setTokens(uri, indexingState.tokens);
    index.setParseErrors(uri, indexingState.parseErrors);
}
