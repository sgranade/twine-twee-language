import { Diagnostic, Range } from "vscode-languageserver";

import { DecorationRange, DiagnosticCode } from "@tt3/shared";
import { EmbeddedDocument } from "./embedded-languages";
import { Passage, ProjSymbol, StoryData } from "./project-index";
import { SemanticToken } from "./semantic-tokens";

/**
 * At what level of detail to parse a Twee document.
 */
export enum ParseLevel {
    /**
     * Just the StoryData passage (if it exists) -- used to find the story format quickly.
     */
    StoryData = 1,
    /**
     * StoryData and names of passages, but not the content of passages.
     */
    PassageNames,
    /**
     * Everything.
     */
    Full,
}

/**
 * Callbacks during parsing.
 */
export interface ParserCallbacks {
    onPassage(passage: Passage): void;
    onSymbolDefinition(symbol: ProjSymbol): void;
    onSymbolReference(symbol: ProjSymbol): void;
    onStoryTitle(title: string, range: Range): void;
    onStoryData(data: StoryData, range: Range): void;
    onEmbeddedDocument(document: EmbeddedDocument): void;
    onSemanticToken(token: SemanticToken): void;
    onFoldingRange(range: Range): void;
    onDecorationRange(range: DecorationRange): void;
    onParseError(error: Diagnostic): void;
    onDisabledDiagnosticRange(code: DiagnosticCode, range: Range): void;
}
