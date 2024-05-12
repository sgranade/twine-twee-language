import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../embedded-languages";
import { Passage, StoryData } from "../index";
import { ParserCallbacks, ParsingState } from "../parser";
import { Token } from "../tokens";

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
    callbacks = new MockCallbacks(),
}): ParsingState {
    return {
        textDocument: TextDocument.create(uri, "twee3", 1, content),
        passageTextParser: undefined,
        callbacks,
    };
}

export class MockCallbacks implements ParserCallbacks {
    public passages: Passage[] = [];
    public passageContents: string[] = [];
    public storyTitle?: string;
    public storyTitleRange?: Range;
    public storyData?: StoryData;
    public storyDataRange?: Range;
    public embeddedDocuments: EmbeddedDocument[] = [];
    public tokens: Token[] = [];
    public errors: Diagnostic[] = [];

    onPassage(passage: Passage): void {
        this.passages.push(passage);
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
    onToken(token: Token): void {
        this.tokens.push(token);
    }
    onParseError(error: Diagnostic): void {
        this.errors.push(error);
    }
}
