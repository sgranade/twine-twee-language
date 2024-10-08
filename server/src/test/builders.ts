import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../embedded-languages";
import { Passage, StoryData, Symbol } from "../project-index";
import { ParseLevel, ParserCallbacks, ParsingState } from "../parser";
import { defaultDiagnosticsOptions } from "../server-options";
import { SemanticToken } from "../tokens";

export function buildPassage({
    label = "Passage",
    location = {
        uri: "fake-uri",
        range: Range.create(1, 1, 2, 2),
    },
    scope = Range.create(3, 3, 4, 4),
    isScript = false,
    isStylesheet = false,
    tags = undefined,
    metadata = undefined,
}): Passage {
    return {
        name: {
            contents: label,
            location: location,
        },
        scope: scope,
        isScript: isScript,
        isStylesheet: isStylesheet,
        tags: tags,
        metadata: metadata,
    };
}

export function buildParsingState({
    uri = "fake-uri",
    content = "content",
    parseLevel = ParseLevel.Full,
    callbacks = new MockCallbacks(),
    diagnosticsOptions = defaultDiagnosticsOptions,
}): ParsingState {
    return {
        textDocument: TextDocument.create(uri, "twee3", 1, content),
        parseLevel: parseLevel,
        storyFormatParser: undefined,
        callbacks: callbacks,
        diagnosticsOptions: diagnosticsOptions,
    };
}

export class MockCallbacks implements ParserCallbacks {
    public passages: Passage[] = [];
    public definitions: Symbol[] = [];
    public references: Symbol[] = [];
    public passageContents: string[] = [];
    public storyTitle?: string;
    public storyTitleRange?: Range;
    public storyData?: StoryData;
    public storyDataRange?: Range;
    public embeddedDocuments: EmbeddedDocument[] = [];
    public tokens: SemanticToken[] = [];
    public errors: Diagnostic[] = [];

    onPassage(passage: Passage): void {
        this.passages.push(passage);
    }
    onSymbolDefinition(symbol: Symbol): void {
        this.definitions.push(symbol);
    }
    onSymbolReference(symbol: Symbol): void {
        this.references.push(symbol);
    }
    onStoryTitle(title: string, range: Range): void {
        this.storyTitle = title;
        this.storyTitleRange = range;
    }
    onStoryData(data: StoryData, range: Range): void {
        this.storyData = data;
        this.storyDataRange = range;
    }
    onEmbeddedDocument(document: EmbeddedDocument): void {
        this.embeddedDocuments.push(document);
    }
    onSemanticToken(token: SemanticToken): void {
        this.tokens.push(token);
    }
    onParseError(error: Diagnostic): void {
        this.errors.push(error);
    }
}
