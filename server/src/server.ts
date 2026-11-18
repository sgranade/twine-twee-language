import {
    CodeAction,
    CompletionList,
    Connection,
    createConnection,
    DefinitionParams,
    Definition,
    DidChangeConfigurationNotification,
    DidCreateFilesNotification,
    DidDeleteFilesNotification,
    DidRenameFilesNotification,
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
    Range,
    ReferenceParams,
    RenameParams,
    ResponseError,
    TextDocumentPositionParams,
    TextDocuments,
    TextDocumentSyncKind,
    WorkspaceEdit,
    PrepareRenameParams,
} from "vscode-languageserver/node";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    CustomMessages,
    DecorationRangeInfo,
    DiagnosticCodes,
    FindFilesRequest,
    FindProjectFilesRequest,
    ReadFileRequest,
    StoryFormat,
} from "@tt3/shared";
import { generateCompletions } from "./completions";
import { getDefinitionAt } from "./definition";
import { createDiagnosticFromRange } from "./diagnostics";
import { generateHover } from "./hover";
import { updateProjectIndex, updateScriptFileIndex } from "./indexer";
import { IndexingQueue } from "./indexing-queue";
import { ParseLevel } from "./parser-types";
import { Index } from "./project-index";
import { getReferencesToSymbolAt } from "./references";
import { generateRenames, prepareRename } from "./renames";
import { semanticTokensLegend } from "./semantic-tokens";
import {
    generateDecorationRanges,
    generateFoldingRanges,
    generateSemanticTokens,
    generateSymbols,
} from "./structure";
import { generateDiagnostics } from "./validator";
import { WorkspaceFileTracker } from "./workspace-file-tracker";
import { getSugarCubeMacroInfo } from "./passage-text-parsers/sugarcube";
import {
    setCustomMacrosAndEnums,
    tweeConfigFileToMacrosAndEnums,
} from "./passage-text-parsers/sugarcube/macros";
import { generateCodeActions } from "./code-actions";

const connection: Connection = createConnection(ProposedFeatures.all);

const documents: TextDocuments<TextDocument> = new TextDocuments(TextDocument);

const projectIndex = new Index();

let hasConfigurationCapability = false;
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let hasCompletionListItemDefaults = false;
let hasDiagnosticRelatedInformationCapability = false;
let hasPrepareProviderCapability = false;
let hasDocumentChangesCapability = false;

const indexingQueue = new IndexingQueue({
    clock: {
        now: () => Date.now(),
        setInterval: (cb, ms) => setInterval(cb, ms),
        clearInterval: (handle) =>
            clearInterval(handle as ReturnType<typeof setInterval>),
    },
    index: projectIndex,
    getOpenDocument: (uri) => documents.get(uri),
    getAllOpenDocuments: () => documents.all(),
    readFile: (uri) => fetchFile(uri),
    findProjectFiles: () => connection.sendRequest(FindProjectFilesRequest),
    findFiles: (glob) => connection.sendRequest(FindFilesRequest, glob),
    indexStoryData: (doc) =>
        updateProjectIndex(doc, ParseLevel.StoryData, projectIndex),
    indexScriptFile: (doc, role) =>
        updateScriptFileIndex(doc, role, ParseLevel.Full, projectIndex),
    parseDocument: (doc, level, reindex) =>
        parseTextDocument(doc, level, reindex),
    validateDocument: (doc) => validateTextDocument(doc),
    sendDecorationRanges: (uri) => sendDecorationRanges(uri),
    onStoryFormatChange: (format) => onStoryFormatChange(format),
    processAllOpenDocuments: () => processAllOpenDocuments(),
    parseMacroFile: (uri) => parseT3LTMacroFile(uri),
    onMacroChanges: () => onSCMacroChanges(),
    indexingStarted: () =>
        connection.sendNotification(CustomMessages.IndexingStarted),
    indexingComplete: () =>
        void connection.sendNotification(CustomMessages.IndexingComplete),
    logError: (message) => connection.console.error(message),
});

const fileTracker = new WorkspaceFileTracker({
    index: projectIndex,
    queue: indexingQueue,
    processAllOpenDocuments: () => processAllOpenDocuments(),
    parseMacroFile: (uri) => parseT3LTMacroFile(uri),
    onMacroChanges: () => onSCMacroChanges(),
});

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
    hasDocumentChangesCapability =
        !!capabilities.workspace?.workspaceEdit?.documentChanges;

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
            codeActionProvider: true,
            completionProvider: {
                triggerCharacters: ["{", "[", "<", "'", '"', "$", "_"], // the last two are SugarCube variable sigils
                // TODO create a resolve provider
                resolveProvider: false,
            },
            definitionProvider: true,
            // Right now we don't support pull diagnostics b/c as of VS Code 1.94.2 (2024/10/09) it's flaky
            // diagnosticProvider: {
            //     interFileDependencies: true,
            //     workspaceDiagnostics: false,
            // },
            documentSymbolProvider: true,
            foldingRangeProvider: true,
            hoverProvider: true,
            referencesProvider: true,
            renameProvider: true,
            semanticTokensProvider: {
                legend: semanticTokensLegend,
                full: true,
            },
            // We're interested in file stuff involving Twee files
            workspace: {
                fileOperations: {
                    didCreate: {
                        filters: [
                            {
                                scheme: "file",
                                pattern: {
                                    glob: "**/*.{tw,twee}",
                                },
                            },
                        ],
                    },
                    didDelete: {
                        filters: [
                            {
                                scheme: "file",
                                pattern: {
                                    glob: "**/*.{tw,twee}",
                                },
                            },
                        ],
                    },
                    didRename: {
                        filters: [
                            {
                                scheme: "file",
                                pattern: {
                                    glob: "**/*.{tw,twee}",
                                },
                            },
                        ],
                    },
                },
            },
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
            undefined,
        );
    }

    // Set up the indexing queue
    indexingQueue.start();

    // Index all Twee files in the workspace
    indexingQueue.indexWorkspace();
});

// Diagnostics -- pull interface
// Right now we don't support pull diagnostics b/c as of VS Code 1.94.2 (2024/10/09) it's flaky
// connection.languages.diagnostics.on(async (params) => {
//     const document = documents.get(params.textDocument.uri);
//     if (document !== undefined) {
//         return {
//             kind: DocumentDiagnosticReportKind.Full,
//             items: await validateTextDocument(document),
//         } satisfies DocumentDiagnosticReport;
//     } else {
//         // We don't know the document.
//         return {
//             kind: DocumentDiagnosticReportKind.Full,
//             items: [],
//         } satisfies DocumentDiagnosticReport;
//     }
// });

connection.onCodeAction((params): CodeAction[] => {
    const passage = projectIndex.getPassageAt(
        params.textDocument.uri,
        params.range.start,
    );
    if (passage === undefined) {
        return [];
    }
    return generateCodeActions(
        params.textDocument.uri,
        passage,
        params.context.diagnostics,
    );
});

connection.onCompletion(
    async (
        params: TextDocumentPositionParams,
    ): Promise<CompletionList | null> => {
        const document = documents.get(params.textDocument.uri);
        if (document === undefined) {
            return null;
        }
        return await generateCompletions(
            document,
            params.position,
            projectIndex,
            hasDiagnosticRelatedInformationCapability,
        );
    },
);

connection.onDefinition((params: DefinitionParams): Definition | undefined => {
    const document = documents.get(params.textDocument.uri);
    if (document === undefined) {
        return undefined;
    }
    return getDefinitionAt(document, params.position, projectIndex);
});

documents.onDidChangeContent(async (change) => {
    // Parse w/re-indexing
    await parseTextDocument(change.document, ParseLevel.Full, true);
    // Validate
    await validateTextDocument(change.document);
    // Update decoration ranges
    sendDecorationRanges(change.document.uri);
});

// documents.onDidClose;

connection.onDidChangeWatchedFiles((_change) => {
    fileTracker.handleWatchedFileChanges(
        (_change.changes ?? []).map((c) => ({
            uri: c.uri,
            deleted: c.type === FileChangeType.Deleted,
        })),
    );
});

documents.onDidOpen(async (change) => {
    // Parse w/re-indexing
    await parseTextDocument(change.document, ParseLevel.Full, true);
    // Validate
    await validateTextDocument(change.document);
    // Update decoration ranges
    sendDecorationRanges(change.document.uri);
});

connection.onDocumentSymbol(
    (params: DocumentSymbolParams): DocumentSymbol[] | null => {
        return generateSymbols(params.textDocument.uri, projectIndex);
    },
);

connection.onFoldingRanges(
    (params: FoldingRangeParams): FoldingRange[] | null => {
        return generateFoldingRanges(params.textDocument.uri, projectIndex);
    },
);

connection.onHover(
    async (params: HoverParams): Promise<Hover | null | undefined> => {
        const document = documents.get(params.textDocument.uri);
        if (document === undefined) {
            return null;
        }
        return await generateHover(document, params.position, projectIndex);
    },
);

connection.onNotification(CustomMessages.RequestReindex, () => {
    indexingQueue.indexWorkspace();
});

connection.onNotification(CustomMessages.RequestDecorationRanges, (uri) => {
    sendDecorationRanges(uri);
});

connection.onNotification(DidCreateFilesNotification.type, async (params) => {
    await fileTracker.handleFilesCreated(params.files.map((f) => f.uri));
});

connection.onNotification(DidDeleteFilesNotification.type, async (params) => {
    await fileTracker.handleFilesDeleted(params.files.map((f) => f.uri));
});

connection.onNotification(DidRenameFilesNotification.type, async (params) => {
    await fileTracker.handleFilesRenamed(params.files);
});

connection.onPrepareRename((params: PrepareRenameParams): Range | undefined => {
    return prepareRename(
        params.textDocument.uri,
        params.position,
        projectIndex,
    );
});

connection.onRenameRequest(
    (params: RenameParams): WorkspaceEdit | ResponseError<void> | null => {
        return generateRenames(
            params.textDocument.uri,
            params.position,
            params.newName,
            projectIndex,
            undefined,
            {
                documentChanges: hasDocumentChangesCapability,
                versionOf: (uri) => documents.get(uri)?.version ?? null,
            },
        );
    },
);

connection.onReferences((params: ReferenceParams): Location[] | undefined => {
    return getReferencesToSymbolAt(
        params.textDocument.uri,
        params.position,
        projectIndex,
        params.context.includeDeclaration,
    );
});

connection.onRequest("textDocument/semanticTokens/full", (params) => {
    return generateSemanticTokens(params.textDocument.uri, projectIndex);
});

connection.onShutdown(() => {
    indexingQueue.stop();
});

/**
 * Fetch a file from the client.
 *
 * @param uri URI of the document to fetch.
 * @param [langId="twee3"] The language ID for the resulting text document.
 * @returns A text document containing the file's contents, or undefined if we weren't able to read it.
 */
async function fetchFile(
    uri: string,
    langId: string = "twee3",
): Promise<TextDocument | undefined> {
    try {
        const content = await connection.sendRequest(ReadFileRequest, {
            uri: uri,
        });
        return TextDocument.create(uri, langId, 1, content);
    } catch (err) {
        connection.console.error(`Client didn't read file ${uri}: ${err}`);
        if (!(err instanceof ResponseError)) throw err;
    }

    return undefined;
}

/**
 * Parse a document.
 *
 * This does not update the diagnostics.
 *
 * @param document Document to process.
 * @param parseLevel What level of parsing to do.
 * @param reindexOnStoryFormatChange If true and the story format changes, re-index all project files.
 */
async function parseTextDocument(
    document: TextDocument,
    parseLevel: ParseLevel,
    reindexOnStoryFormatChange: boolean,
) {
    // Keep track of the story title and format so, if either changes, we can notify
    // listeners and (optionally, for changed story format) request a full re-index
    const storyTitle = projectIndex.getStoryTitle();
    const storyFormat = projectIndex.getStoryData()?.storyFormat;

    updateProjectIndex(document, parseLevel, projectIndex);

    const newStoryTitle = projectIndex.getStoryTitle();
    const newStoryFormat = projectIndex.getStoryData()?.storyFormat;
    if (newStoryTitle && newStoryTitle !== storyTitle) {
        onStoryTitleChange(newStoryTitle);
    }
    if (
        newStoryFormat?.format &&
        (newStoryFormat?.format !== storyFormat?.format ||
            newStoryFormat?.formatVersion !== storyFormat?.formatVersion)
    ) {
        onStoryFormatChange(newStoryFormat);
        if (reindexOnStoryFormatChange) {
            indexingQueue.indexWorkspace();
        }
    }

    // Request a refresh of semantic tokens since we've potentially changed them
    connection.languages.semanticTokens.refresh();
}

/**
 * Handle changes to the SugarCube macros.
 */
function onSCMacroChanges() {
    connection.sendNotification(
        CustomMessages.UpdatedSugarCubeMacroList,
        getSugarCubeMacroInfo(),
    );
}

/**
 * Handle a changed story format.
 *
 * @param format New story format.
 */
function onStoryFormatChange(format: StoryFormat) {
    connection.sendNotification(CustomMessages.UpdatedStoryFormat, format);
    // If the story format is SugarCube 2, we need to look for macro definition files
    if (format.format.toLowerCase() === "sugarcube") {
        indexingQueue.indexSugarCubeMacros();
    }
}

/**
 * Handle a changed story title.
 *
 * @param title New story title.
 */
function onStoryTitleChange(title: string) {
    connection.sendNotification(CustomMessages.UpdatedStoryTitle, title);
}

/**
 * Send decoration ranges for a document.
 *
 * @param uri Document to send decoration ranges for.
 */
function sendDecorationRanges(uri: string) {
    const rangeInfo: DecorationRangeInfo = {
        uri: uri,
        ranges: generateDecorationRanges(uri, projectIndex),
    };
    connection.sendNotification(CustomMessages.DecorationRanges, rangeInfo);
}

/**
 * Parse a T3LT custom macro file.
 *
 * The macro file should be either a YAML or JSON file.
 *
 * @param uri URI to the macro file.
 */
async function parseT3LTMacroFile(uri: string) {
    const isYaml = /\.ya?ml$/.test(uri);
    const doc = await fetchFile(uri, isYaml ? "yaml" : "json");
    if (doc !== undefined) {
        const parsedResults = tweeConfigFileToMacrosAndEnums(
            doc.getText(),
            isYaml,
        );
        if (parsedResults.macrosAndEnums !== undefined) {
            setCustomMacrosAndEnums(uri, parsedResults.macrosAndEnums);
        }
        if (parsedResults.errors.length) {
            const diagnostics = [
                createDiagnosticFromRange(
                    DiagnosticCodes.SugarCubeMacroFileError,
                    Range.create(0, 0, 1, 0),
                    `Problems with the configuration file: ${parsedResults.errors.join("\n")}`,
                ),
            ];
            connection.sendDiagnostics({
                uri: uri,
                diagnostics: diagnostics,
            });
        }
    }
}

/**
 * Process all open documents that we're tracking.
 *
 * Used when there's a change (such as re-indexing or changing validation
 * options) that could affect parsing.
 */
async function processAllOpenDocuments() {
    // Loop through twice since validation can depend on the result of parsing all docs
    for (const doc of documents.all()) {
        await parseTextDocument(doc, ParseLevel.Full, true);
    }
    for (const doc of documents.all()) {
        await validateTextDocument(doc);
    }

    // Request that the client re-do diagnostics since we've re-processed
    connection.languages.diagnostics.refresh();
}

/**
 * Validate a document and get any diagnostics arising from that validation.
 *
 * @param textDocument Document to validate.
 */
async function validateTextDocument(textDocument: TextDocument) {
    const diagnostics = await generateDiagnostics(textDocument, projectIndex);

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
