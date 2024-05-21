import {
    CompletionList,
    DefinitionParams,
    Definition,
    Diagnostic,
    DidChangeConfigurationNotification,
    DocumentDiagnosticReport,
    DocumentDiagnosticReportKind,
    DocumentSymbol,
    DocumentSymbolParams,
    FoldingRange,
    FoldingRangeParams,
    Hover,
    HoverParams,
    InitializeParams,
    InitializeResult,
    Location,
    ProposedFeatures,
    ReferenceParams,
    RenameParams,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
    WorkspaceEdit,
    createConnection,
    PrepareRenameParams,
    Range,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import { CustomMessages, StoryFormat } from "./client-server";
import { generateCompletions } from "./completions";
import { generateHover } from "./hover";
import { Index } from "./index";
import { updateProjectIndex } from "./indexer";
import { generateRenames } from "./searches";
import {
    generateFoldingRanges,
    generateSemanticTokens,
    generateSymbols,
} from "./structure";
import { semanticTokensLegend } from "./tokens";
import { generateDiagnostics } from "./validator";

const connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const projectIndex = new Index();

let hasConfigurationCapability = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasPrepareProviderCapability = false;

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
    hasPrepareProviderCapability =
        !!capabilities.textDocument?.rename?.prepareSupport;

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
            hoverProvider: true,
            semanticTokensProvider: {
                legend: semanticTokensLegend,
                full: true,
            },
            definitionProvider: true,
            referencesProvider: true,
            renameProvider: true,
        },
    };
    if (hasPrepareProviderCapability) {
        result.capabilities.renameProvider = { prepareProvider: true };
    }
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
    const storyFormat = projectIndex.getStoryData()?.storyFormat?.format;
    updateProjectIndex(document, true, projectIndex);
    const newStoryFormat = projectIndex.getStoryData()?.storyFormat;
    if (newStoryFormat?.format !== storyFormat && newStoryFormat?.format) {
        const e: StoryFormat = {
            format: newStoryFormat.format,
            formatVersion: newStoryFormat.formatVersion,
        };
        connection.sendNotification(CustomMessages.UpdatedStoryFormat, e);
    }
}

connection.onCompletion(
    async (
        params: TextDocumentPositionParams
    ): Promise<CompletionList | null> => {
        const document = documents.get(params.textDocument.uri);
        if (document === undefined) {
            return null;
        }
        return await generateCompletions(
            document,
            params.position,
            projectIndex
        );
    }
);

connection.onDefinition((params: DefinitionParams): Definition | undefined => {
    const definition = projectIndex.getDefinitionAt(
        params.textDocument.uri,
        params.position
    );
    if (definition !== undefined) return definition.location;
    return undefined;
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

connection.onHover(
    async (params: HoverParams): Promise<Hover | null | undefined> => {
        const document = documents.get(params.textDocument.uri);
        if (document === undefined) {
            return null;
        }
        return await generateHover(document, params.position, projectIndex);
    }
);

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    return generateRenames(
        params.textDocument.uri,
        params.position,
        params.newName,
        projectIndex
    );
});

connection.onPrepareRename((params: PrepareRenameParams): Range | undefined => {
    const symbol = projectIndex.getSymbolAt(
        params.textDocument.uri,
        params.position
    );
    if (symbol !== undefined) {
        return symbol.location.range;
    }
    return undefined;
});

connection.onReferences((params: ReferenceParams): Location[] | undefined => {
    const references = projectIndex.getReferencesAt(
        params.textDocument.uri,
        params.position,
        params.context.includeDeclaration
    );
    if (references !== undefined) return references.locations;
    return undefined;
});

connection.onRequest("textDocument/semanticTokens/full", (params) => {
    return generateSemanticTokens(params.textDocument.uri, projectIndex);
});

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
