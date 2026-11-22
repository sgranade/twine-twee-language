import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    DecorationRange,
    DiagnosticCode,
    DiagnosticCodes,
    DiagnosticMap,
} from "@tt3/shared";
import { createDiagnosticFromRange } from "./diagnostics";
import { EmbeddedDocument } from "./embedded-languages";
import { parse, parseScriptFile } from "./parser";
import { ParseLevel, ParserCallbacks } from "./parser-types";
import { getStoryFormatParser } from "./passage-text-parsers";
import {
    calleeFlag,
    opaqueFlag,
    shorthandFlag,
    sigilFlag,
    Passage,
    ProjectIndex,
    ProjSymbol,
    References,
    ScriptFileRole,
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
 * Collate individual references by kind, name, and per-occurrence flags so
 * e.g. diagnostics can exempt call sites w/o exempting plain reads.
 */
function collateReferences(symbols: ProjSymbol[]): References[] {
    const referencesMap: Record<string, References> = {};
    for (const symbol of symbols) {
        const key = `${symbol.kind},${symbol.contents},${!!symbol.isCallee},${!!symbol.sigilOutsideRange},${!!symbol.shorthand},${!!symbol.opaque}`;
        const ref = referencesMap[key] || {
            contents: symbol.contents,
            locations: [],
            kind: symbol.kind,
            ...calleeFlag(symbol),
            ...sigilFlag(symbol),
            ...shorthandFlag(symbol),
            ...opaqueFlag(symbol),
        };
        ref.locations.push(symbol.location);
        referencesMap[key] = ref;
    }
    return Object.values(referencesMap);
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
 * @param getParser: Function that gets a story-format-specific parser.
 */
export function updateProjectIndex(
    textDocument: TextDocument,
    parseLevel: ParseLevel,
    index: ProjectIndex,
    getParser: typeof getStoryFormatParser = getStoryFormatParser,
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
        getParser,
    );

    const references = collateReferences(indexingState.references);

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

// Stub no-op parser callbacks
const noop = (): void => {};
const noopCallbacks: ParserCallbacks = {
    onPassage: noop,
    onSymbolDefinition: noop,
    onSymbolReference: noop,
    onStoryTitle: noop,
    onStoryData: noop,
    onEmbeddedDocument: noop,
    onSemanticToken: noop,
    onFoldingRange: noop,
    onDecorationRange: noop,
    onParseError: noop,
    onDisabledDiagnosticRange: noop,
};

/**
 * Update a project index for a local `.js` file in that project.
 *
 * @param textDocument Script file to index.
 * @param role Role the script file plays in the project.
 * @param parseLevel Level of parsing to do.
 * @param index Project index to update.
 * @param getParser Function that gets a story-format-specific parser.
 */
export function updateScriptFileIndex(
    textDocument: TextDocument,
    role: ScriptFileRole,
    parseLevel: ParseLevel,
    index: ProjectIndex,
    getParser: typeof getStoryFormatParser = getStoryFormatParser,
): void {
    const uri = textDocument.uri;
    index.removeDocument(uri);
    index.setScriptFileRole(uri, role);

    const definitions: ProjSymbol[] = [];
    const symbols: ProjSymbol[] = [];
    parseScriptFile(
        textDocument,
        // We only capture symbol definitions and references
        {
            ...noopCallbacks,
            onSymbolDefinition: (symbol) => definitions.push(symbol),
            onSymbolReference: (symbol) => symbols.push(symbol),
        },
        parseLevel,
        index.getStoryData()?.storyFormat,
        getParser,
    );

    index.setDefinitions(uri, definitions);
    index.setReferences(uri, collateReferences(symbols));
}
