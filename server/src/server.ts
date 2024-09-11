import {
    CompletionList,
    Connection,
    DefinitionParams,
    Definition,
    Diagnostic,
    DidChangeConfigurationNotification,
    DocumentDiagnosticReport,
    DocumentDiagnosticReportKind,
    DocumentSymbol,
    DocumentSymbolParams,
    FileChangeType,
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
    ResponseError,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    CustomMessages,
    FindTweeFilesRequest,
    ReadFileRequest,
    StoryFormat,
} from "./client-server";
import { generateCompletions } from "./completions";
import { getDefinitionAt } from "./definition";
import { generateHover } from "./hover";
import { updateProjectIndex } from "./indexer";
import { Index } from "./project-index";
import { generateRenames } from "./searches";
import {
    DiagnosticsOptions,
    defaultDiagnosticsOptions,
} from "./server-options";
import {
    generateFoldingRanges,
    generateSemanticTokens,
    generateSymbols,
} from "./structure";
import { semanticTokensLegend } from "./tokens";
import { generateDiagnostics } from "./validator";
import { ParseLevel } from "./parser";
import { getReferencesToSymbolAt } from "./references";

const connection: Connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const projectIndex = new Index();

let hasConfigurationCapability = false;
let hasCompletionListItemDefaults = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasPrepareProviderCapability = false;

/**
 * Handle potentially long-running tasks that shouldn't run concurrently.
 */
namespace Heartbeat {
    const interval = 200; // Interval between calling the heartbeat run function, in ms
    const minTimeBetween = 50; // Minimum time to wait between heartbeat calls, in ms
    let lastTime = -1; // Last time the heartbeat ran, in ms since epoch
    let heartbeatId: ReturnType<typeof setInterval> | undefined;
    let running = false;

    let workspaceReindexRequested = false; // Whether a project re-index has been requested

    /**
     * Start the heartbeat.
     */
    export function start() {
        heartbeatId = setInterval(run, interval);
    }

    /**
     * Stop the heartbeat.
     */
    export function stop() {
        clearInterval(heartbeatId);
    }

    /**
     * Reindex the workspace.
     */
    export function indexWorkspace(): void {
        workspaceReindexRequested = true;
    }

    async function run() {
        if (running || Date.now() < lastTime + minTimeBetween) {
            return;
        }
        try {
            running = true;
            if (workspaceReindexRequested) {
                await indexAllTweeFiles();
                workspaceReindexRequested = false;
            }
        } finally {
            running = false;
            lastTime = Date.now();
        }
    }

    /**
     * Fetch a Twee file.
     *
     * @param uri URI of the document to fetch.
     * @returns A text document containing the file's contents, or undefined if we weren't able to read it.
     */
    async function fetchTweeFile(
        uri: string
    ): Promise<TextDocument | undefined> {
        try {
            const content = await connection.sendRequest(ReadFileRequest, {
                uri: uri,
            });
            return TextDocument.create(uri, "twee3", 1, content);
        } catch (err) {
            connection.console.error(`Client didn't read file ${uri}: ${err}`);
            if (!(err instanceof ResponseError)) throw err;
        }

        return undefined;
    }

    /**
     * Index all Twee files in an opened project, as reported by the client.
     */
    async function indexAllTweeFiles() {
        // Remove all indexed files that aren't in our document store,
        // as we've not opened them and aren't tracking them, and thus
        // only fast-indexed them
        for (const uri of projectIndex.getIndexedUris()) {
            if (documents.get(uri) === undefined) {
                projectIndex.removeDocument(uri);
            }
        }

        try {
            const tweeFiles =
                await connection.sendRequest(FindTweeFilesRequest);

            // We'll loop through the files twice, once to find a StoryData
            // value, and then a second time to parse passages, since
            // the story format can change how even passage-name-only
            // parsing occurs.

            // Right now we don't cache the results so as not to have to
            // potentially hold every file in a project in memory.
            for (const uri of tweeFiles) {
                // The moment we have a story format, we can stop looking.
                if (projectIndex.getStoryData()?.storyFormat !== undefined)
                    break;

                const doc = await fetchTweeFile(uri);
                if (doc !== undefined) {
                    updateProjectIndex(doc, ParseLevel.StoryData, projectIndex);
                }
            }

            for (const uri of tweeFiles) {
                const doc = await fetchTweeFile(uri);
                if (doc !== undefined) {
                    await processChangedDocument(doc, ParseLevel.PassageNames);
                }
            }

            await processAllOpenDocuments();
        } catch (err) {
            connection.console.error(`Client couldn't find Twee files: ${err}`);
        }
    }
}

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
    const itemDefaults =
        capabilities.textDocument?.completion?.completionList?.itemDefaults;
    if (itemDefaults) {
        hasCompletionListItemDefaults = !!(
            "editRange" in itemDefaults && "insertTextFormat" in itemDefaults
        );
    }
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
                triggerCharacters: ["{", "[", "<", "'", '"'],
                // TODO create a resolve provider
                resolveProvider: false,
            },
            diagnosticProvider: {
                interFileDependencies: true,
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

connection.onInitialized(async () => {
    if (hasConfigurationCapability) {
        // Register for all configuration changes.
        connection.client.register(
            DidChangeConfigurationNotification.type,
            undefined
        );
    }

    // Set up the heartbeat
    Heartbeat.start();

    // Index all Twee files in the workspace
    Heartbeat.indexWorkspace();
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
        // We don't know the document.
        return {
            kind: DocumentDiagnosticReportKind.Full,
            items: [],
        } satisfies DocumentDiagnosticReport;
    }
});

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
            projectIndex,
            hasDiagnosticRelatedInformationCapability
        );
    }
);

connection.onDefinition((params: DefinitionParams): Definition | undefined => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
        return undefined;
    }
    return getDefinitionAt(document, params.position, projectIndex);
});

connection.onDidChangeConfiguration(async (change) => {
    // Only re-parse if our parse-affecting options have changed
    const prev = lastSettings["twee-3"];
    const cur = (await getSettings())["twee-3"];
    if (
        prev.warnings.unknownMacro != cur.warnings.unknownMacro ||
        prev.warnings.unknownPassage != cur.warnings.unknownPassage
    ) {
        await processAllOpenDocuments();
    }
});

documents.onDidChangeContent(async (change) => {
    await processChangedDocument(change.document, ParseLevel.Full);
});

documents.onDidClose;

connection.onDidChangeWatchedFiles((_change) => {
    for (const change of _change.changes || []) {
        if (change.type === FileChangeType.Deleted) {
            projectIndex.removeDocument(change.uri);
        }
    }
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

connection.onNotification(CustomMessages.RequestReindex, () => {
    Heartbeat.indexWorkspace();
});

connection.onPrepareRename((params: PrepareRenameParams): Range | undefined => {
    const symbol = projectIndex.getDefinitionAt(
        params.textDocument.uri,
        params.position
    );
    if (symbol !== undefined) {
        return symbol.location.range;
    }
    return undefined;
});

connection.onRenameRequest((params: RenameParams): WorkspaceEdit | null => {
    return generateRenames(
        params.textDocument.uri,
        params.position,
        params.newName,
        projectIndex
    );
});

connection.onReferences((params: ReferenceParams): Location[] | undefined => {
    // TODO do I need the full document, or would the URI suffice?
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
        return undefined;
    }
    return getReferencesToSymbolAt(
        document,
        params.position,
        projectIndex,
        params.context.includeDeclaration
    );
});

connection.onRequest("textDocument/semanticTokens/full", (params) => {
    return generateSemanticTokens(params.textDocument.uri, projectIndex);
});

connection.onShutdown(() => {
    Heartbeat.stop();
});

/**
 * Settings for the server. Synchronize with "configuration" in the main package.json.
 */
interface ServerSettings {
    "twee-3": DiagnosticsOptions;
}

const defaultSettings: ServerSettings = {
    "twee-3": defaultDiagnosticsOptions,
};

let lastSettings = defaultSettings;

async function getSettings(): Promise<ServerSettings> {
    if (!hasConfigurationCapability) {
        return Promise.resolve(defaultSettings);
    }
    lastSettings = await connection.workspace.getConfiguration({
        section: "twineTweeLanguage", // From the package.json file
    });

    return lastSettings;
}

/**
 * Process a document whose content has changed.
 *
 * @param document Document to process.
 * @param parseLevel What level of parsing to do.
 */
async function processChangedDocument(
    document: TextDocument,
    parseLevel: ParseLevel
) {
    // We'll only get the diagnostic options if we're parsing passage
    // contents, since otherwise we're just collecting passage names
    let diagnosticsOptions = defaultDiagnosticsOptions;
    if (parseLevel === ParseLevel.Full) {
        const settings = await getSettings();
        diagnosticsOptions = settings["twee-3"];
    }

    // Keep track of the story format so, if it changes, we can notify listeners
    const storyFormat = projectIndex.getStoryData()?.storyFormat?.format;
    updateProjectIndex(document, parseLevel, projectIndex, diagnosticsOptions);
    const newStoryFormat = projectIndex.getStoryData()?.storyFormat;
    if (newStoryFormat?.format !== storyFormat && newStoryFormat?.format) {
        const e: StoryFormat = {
            format: newStoryFormat.format,
            formatVersion: newStoryFormat.formatVersion,
        };
        connection.sendNotification(CustomMessages.UpdatedStoryFormat, e);
    }

    // Request a refresh of semantic tokens since we've potentially changed them
    connection.languages.semanticTokens.refresh();
}

/**
 * Process all open documents that we're tracking.
 *
 * Used when there's a change (such as re-indexing or changing validation
 * options) that could affect parsing.
 */
async function processAllOpenDocuments() {
    for (const doc of documents.all()) {
        await processChangedDocument(doc, ParseLevel.Full);
    }
    // Request that the client re-do diagnostics since we've re-processed
    connection.languages.diagnostics.refresh();
}

/**
 * Validate a document and get any diagnostics arising from that validation.
 *
 * @param textDocument Document to validate.
 * @returns Diagnostics for the given document.
 */
async function validateTextDocument(
    textDocument: TextDocument
): Promise<Diagnostic[]> {
    const diagnosticsOptions = (await getSettings())["twee-3"];

    const diagnostics = await generateDiagnostics(
        textDocument,
        projectIndex,
        diagnosticsOptions
    );

    return diagnostics;
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
