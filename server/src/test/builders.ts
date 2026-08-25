import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DecorationRange, DiagnosticCode, DiagnosticMap } from "@tt3/shared";
import { EmbeddedDocument } from "../embedded-languages";
import { ParseLevel, ParserCallbacks, ParsingState } from "../parser";
import { Label, Passage, ProjSymbol, StoryData } from "../project-index";
import { SemanticToken } from "../semantic-tokens";

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

export function buildTag(
    name = "tag",
    location = { uri: "fake-uri", range: Range.create(5, 5, 6, 6) },
): Label {
    return {
        contents: name,
        location: location,
    };
}

export function buildParsingState({
    uri = "fake-uri",
    content = "content",
    parseLevel = ParseLevel.Full,
    callbacks = new MockCallbacks(),
}): ParsingState {
    return {
        textDocument: TextDocument.create(uri, "twee3", 1, content),
        parseLevel: parseLevel,
        storyFormatParser: undefined,
        callbacks: callbacks,
    };
}

export class MockCallbacks implements ParserCallbacks {
    public passages: Passage[] = [];
    public definitions: ProjSymbol[] = [];
    public references: ProjSymbol[] = [];
    public passageContents: string[] = [];
    public storyTitle?: string;
    public storyTitleRange?: Range;
    public storyData?: StoryData;
    public storyDataRange?: Range;
    public embeddedDocuments: EmbeddedDocument[] = [];
    public tokens: SemanticToken[] = [];
    public foldingRanges: Range[] = [];
    public decorationRanges: DecorationRange[] = [];
    public errors: Diagnostic[] = [];
    public disabledDiagnosticRanges: DiagnosticMap<Range[]> = {};

    onPassage(passage: Passage): void {
        this.passages.push(passage);
    }
    onSymbolDefinition(symbol: ProjSymbol): void {
        this.definitions.push(symbol);
    }
    onSymbolReference(symbol: ProjSymbol): void {
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
    onFoldingRange(range: Range): void {
        this.foldingRanges.push(range);
    }
    onDecorationRange(range: DecorationRange): void {
        this.decorationRanges.push(range);
    }
    onParseError(error: Diagnostic): void {
        this.errors.push(error);
    }
    onDisabledDiagnosticRange(code: DiagnosticCode, range: Range): void {
        if (this.disabledDiagnosticRanges[code] === undefined)
            this.disabledDiagnosticRanges[code] = [];
        this.disabledDiagnosticRanges[code].push(range);
    }
}
