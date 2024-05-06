import {
    createConnection,
    TextDocuments,
    Diagnostic,
    ProposedFeatures,
    InitializeParams,
    DidChangeConfigurationNotification,
    CompletionItem,
    TextDocumentPositionParams,
    TextDocumentSyncKind,
    InitializeResult,
    DocumentDiagnosticReportKind,
    DocumentDiagnosticReport,
    DocumentSymbolParams,
    DocumentSymbol,
    FoldingRangeParams,
    FoldingRange,
    CompletionList,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CustomMessages, StoryFormat } from "./client-server";
import { Index } from "./index";
import { updateProjectIndex } from "./indexer";
import {
    generateFoldingRanges,
    generateSemanticTokens,
    generateSymbols,
    semanticTokensLegend,
} from "./structure";
import { generateDiagnostics } from "./validator";
import { generateCompletions } from "./completions";

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const projectIndex = new Index();

let hasConfigurationCapability = false;
let hasDiagnosticRelatedInformationCapability = false;

connection.onInitialize((params: InitializeParams) => {
    const capabilities = params.capabilities;

    hasConfigurationCapability = !!(
        capabilities.workspace && !!capabilities.workspace.configuration
    );
    hasDiagnosticRelatedInformationCapability = !!(
        capabilities.textDocument &&
        capabilities.textDocument.publishDiagnostics &&
        capabilities.textDocument.publishDiagnostics.relatedInformation
    );

    const result: InitializeResult = {
        capabilities: {
            textDocumentSync: {
                openClose: true,
                // TODO support incremental syncing
                change: TextDocumentSyncKind.Full,
                willSaveWaitUntil: false,
                save: {
                    includeText: false,
                },
            },
            completionProvider: {
                // TODO create a resolve provider
                resolveProvider: false,
            },
            diagnosticProvider: {
                interFileDependencies: false,
                workspaceDiagnostics: false,
            },
            documentSymbolProvider: true,
            foldingRangeProvider: true,
            semanticTokensProvider: {
                legend: semanticTokensLegend,
                full: true,
            },
            // TODO implement definitionProvider, referencesProvider, renameProvider
        },
    };
    return result;
});

connection.onInitialized(() => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }
});

connection.onDidChangeConfiguration((change) => {
    // TODO implement later -- lsp demo has an example
});

// Diagnostics -- pull interface
connection.languages.diagnostics.on(async (params) => {
    const document = documents.get(params.textDocument.uri);
    if (document !== undefined) {
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: await validateTextDocument(document),
        } satisfies DocumentDiagnosticReport;
    } else {
        // We don't know the document. We can either try to read it from disk
        // or we don't report problems for it.
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: [],
        } satisfies DocumentDiagnosticReport;
    }
});

documents.onDidChangeContent((change) => {
    processChangedDocument(change.document);
});

async function validateTextDocument(
    textDocument: TextDocument
): Promise<Diagnostic[]> {
    const diagnostics = await generateDiagnostics(textDocument, projectIndex);

    return diagnostics;
}

connection.onDidChangeWatchedFiles((_change) => {
    // TODO Monitored files have changed in VSCode
    connection.console.log("We received a file change event");
});

/**
 * Process a document whose content has changed.
 */
function processChangedDocument(document: TextDocument) {
    // Keep track of the story format so, if it changes, we can notify listeners
    const storyFormat = projectIndex.getStoryData()?.format;
    updateProjectIndex(document, projectIndex);
    const newStoryData = projectIndex.getStoryData();
    if (newStoryData?.format !== storyFormat && newStoryData?.format) {
        const e: StoryFormat = {
            format: newStoryData.format,
            formatVersion: newStoryData.formatVersion,
        };
        connection.sendNotification(CustomMessages.UpdatedStoryFormat, e);
    }
}

connection.onCompletion(
    async (
        textDocumentPosition: TextDocumentPositionParams
    ): Promise<CompletionList | null> => {
        const document = documents.get(textDocumentPosition.textDocument.uri);
        if (document === undefined) {
            return null;
        }
        const tempy = await generateCompletions(
            document,
            textDocumentPosition.position,
            projectIndex
        );
        return tempy;
    }
);

// This handler resolves additional information for the item selected in
// the completion list.
connection.onCompletionResolve((item: CompletionItem): CompletionItem => {
    if (item.data === 1) {
        item.detail = "TypeScript details";
        item.documentation = "TypeScript documentation";
    } else if (item.data === 2) {
        item.detail = "JavaScript details";
        item.documentation = "JavaScript documentation";
    }
    return item;
});

connection.onDocumentSymbol(
    (params: DocumentSymbolParams): DocumentSymbol[] | null => {
        return generateSymbols(params.textDocument.uri, projectIndex);
    }
);

connection.onFoldingRanges(
    (params: FoldingRangeParams): FoldingRange[] | null => {
        return generateFoldingRanges(params.textDocument.uri, projectIndex);
    }
);

connection.onRequest("textDocument/semanticTokens/full", (params) => {
    return generateSemanticTokens(params.textDocument.uri, projectIndex);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
