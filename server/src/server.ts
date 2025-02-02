import {
    CompletionList,
    Connection,
    DefinitionParams,
    Definition,
    Diagnostic,
    DidChangeConfigurationNotification,
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
    DecorationRangeInfo,
    FindFilesRequest,
    FindTweeFilesRequest,
    ReadFileRequest,
    StoryFormat,
} from "./client-server";
import { generateCompletions } from "./completions";
import { getDefinitionAt } from "./definition";
import { generateHover } from "./hover";
import { updateProjectIndex } from "./indexer";
import { ParseLevel } from "./parser";
import { Index } from "./project-index";
import { getReferencesToSymbolAt } from "./references";
import { generateRenames, prepareRename } from "./searches";
import {
    DiagnosticsOptions,
    defaultDiagnosticsOptions,
} from "./server-options";
import {
    generateDecorationRanges,
    generateFoldingRanges,
    generateSemanticTokens,
    generateSymbols,
} from "./structure";
import { semanticTokensLegend } from "./semantic-tokens";
import { generateDiagnostics } from "./validator";
import { getSugarCubeMacroInfo } from "./passage-text-parsers/sugarcube";
import {
    setCustomMacrosAndEnums,
    tweeConfigFileToMacrosAndEnums,
} from "./passage-text-parsers/sugarcube/macros";

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

    let workspaceIndexRequested = false; // Whether a full project indexing has been requested
    let sugarcubeMacroIndexRequested = false; // Whether we're to index custom SugarCube macro files

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
     * Index the Twee 3 files in the workspace.
     */
    export function indexWorkspace(): void {
        workspaceIndexRequested = true;
    }

    /**
     * Index the SugarCube custom macro files in the workspace.
     */
    export function indexSugarCubeMacros() {
        sugarcubeMacroIndexRequested = true;
    }

    async function run() {
        if (running || Date.now() < lastTime + minTimeBetween) {
            return;
        }
        try {
            running = true;
            // Only do one of the following things during a single heartbeat
            if (workspaceIndexRequested) {
                await indexAllTweeFiles();
            } else if (sugarcubeMacroIndexRequested) {
                await indexT3LTMacroFiles();
            }
        } finally {
            lastTime = Date.now();
            running = false;
        }
    }

    /**
     * Get a document, first from our document store, then (if that fails)
     * by requesting it from the client.
     *
     * @param uri Uri to the document.
     * @returns The document, or undefined if it's not available.
     */
    async function getDoc(uri: string): Promise<TextDocument | undefined> {
        // If the doc is open and we're tracking it, use that verison, as otherwise
        // we'll read an old version from disk
        let doc = documents.get(uri);
        if (doc === undefined) {
            doc = await fetchFile(uri);
        }
        return doc;
    }

    /**
     * Index all Twee files in an opened project, as reported by the client.
     */
    async function indexAllTweeFiles() {
        await connection.sendNotification(CustomMessages.IndexingStarted);

        // Remove all indexed files that aren't in our document store,
        // as we've not opened them and aren't tracking them, and thus
        // only fast-indexed them
        for (const uri of projectIndex.getIndexedUris()) {
            if (documents.get(uri) === undefined) {
                projectIndex.removeDocument(uri);
            }
        }

        try {
            const tweeFileUris = new Set(
                await connection.sendRequest(FindTweeFilesRequest)
            );

            // We'll loop through the files in stages: first to find a StoryData value,
            // and then to validate.

            // Right now we don't cache the file fetch results so as not to have to
            // potentially hold every file in a project in memory.
            const oldStoryFormat = projectIndex.getStoryData()?.storyFormat;
            for (const uri of tweeFileUris) {
                const doc = await getDoc(uri);
                if (doc !== undefined) {
                    updateProjectIndex(doc, ParseLevel.StoryData, projectIndex);
                    // If we get a story format that's different than the old one,
                    // we can stop looking
                    const newStoryFormat =
                        projectIndex.getStoryData()?.storyFormat;
                    if (
                        newStoryFormat?.format !== oldStoryFormat?.format ||
                        newStoryFormat?.formatVersion !==
                            oldStoryFormat?.formatVersion
                    ) {
                        break;
                    }
                }
            }
            const newStoryFormat = projectIndex.getStoryData()?.storyFormat;
            if (
                newStoryFormat !== undefined &&
                (newStoryFormat?.format !== oldStoryFormat?.format ||
                    newStoryFormat?.formatVersion !==
                        oldStoryFormat?.formatVersion)
            ) {
                onStoryFormatChange(newStoryFormat);

                // The story format change may set up other processing
                // we need before we do a full indexing.
                if (sugarcubeMacroIndexRequested) {
                    await indexT3LTMacroFiles();
                }
            }

            const diagnosticsOptions = (await getSettings())["twee-3"];

            for (const uri of tweeFileUris) {
                const doc = await getDoc(uri);
                if (doc !== undefined) {
                    await parseTextDocument(
                        doc,
                        ParseLevel.Full,
                        diagnosticsOptions,
                        false // Don't re-index on story format change b/c we're in the middle of re-indexing
                    );
                }
            }

            for (const uri of tweeFileUris) {
                const doc = await getDoc(uri);
                if (doc !== undefined) {
                    await validateTextDocument(doc, diagnosticsOptions);
                }
            }

            // Re-process any open documents that we didn't handle above.
            // This could happen if the open document doesn't have an expected extension
            // (like a `.txt` file that the user has selected as being a Twine file).
            const unprocessedOpenDocuments = documents
                .all()
                .filter((d) => !tweeFileUris.has(d.uri));
            for (const doc of unprocessedOpenDocuments) {
                await parseTextDocument(
                    doc,
                    ParseLevel.Full,
                    diagnosticsOptions,
                    false // Don't re-index on story format change
                );
            }
            for (const doc of unprocessedOpenDocuments) {
                await validateTextDocument(doc, diagnosticsOptions);
            }
        } catch (err) {
            connection.console.error(`Client couldn't find Twee files: ${err}`);
        }

        connection.sendNotification(CustomMessages.IndexingComplete);
        workspaceIndexRequested = false;
    }

    /**
     * Index all SC2 macro files in a workspace
     */
    async function indexT3LTMacroFiles() {
        try {
            const sc2MacroFileUris = await connection.sendRequest(
                FindFilesRequest,
                "**/*.twee-config.{json,yaml,yml}"
            );
            for (const uri of sc2MacroFileUris) {
                await parseT3LTMacroFile(uri);
            }

            // Once we're done, we need to re-validate any open documents
            await processAllOpenDocuments();

            onSCMacroChanges();
        } catch (err) {
            connection.console.error(
                `Client couldn't find SugarCube 2 macro files: ${err}`
            );
        }

        sugarcubeMacroIndexRequested = false;
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
                triggerCharacters: ["{", "[", "<", "'", '"', "$", "_"], // the last two are SugarCube variable sigils
                // TODO create a resolve provider
                resolveProvider: false,
            },
            // Right now we don't support pull diagnostics b/c as of VS Code 1.94.2 (2024/10/09) it's flaky
            // diagnosticProvider: {
            //     interFileDependencies: true,
            //     workspaceDiagnostics: false,
            // },
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

connection.onDidChangeConfiguration(async () => {
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
    // Parse w/re-indexing if the story format changes
    await parseTextDocument(change.document, ParseLevel.Full, undefined, true);
    // Validate
    await validateTextDocument(change.document, undefined);
    // Update decoration ranges
    sendDecorationRanges(change.document.uri);
});

// documents.onDidClose;

connection.onDidChangeWatchedFiles((_change) => {
    for (const change of _change.changes ?? []) {
        if (
            change.type === FileChangeType.Deleted &&
            /.tw(ee)?$/.test(change.uri)
        ) {
            projectIndex.removeDocument(change.uri);
        } else if (/\.twee-config\.(json|ya?ml)$/.test(change.uri)) {
            parseT3LTMacroFile(change.uri);
            onSCMacroChanges();
        }
    }
});

documents.onDidOpen(async (change) => {
    // Parse w/re-indexing if the story format changes
    await parseTextDocument(change.document, ParseLevel.Full, undefined, true);
    // Validate
    await validateTextDocument(change.document, undefined);
    // Update decoration ranges
    sendDecorationRanges(change.document.uri);
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

connection.onNotification(CustomMessages.RequestDecorationRanges, (uri) => {
    sendDecorationRanges(uri);
});

connection.onPrepareRename((params: PrepareRenameParams): Range | undefined => {
    return prepareRename(
        params.textDocument.uri,
        params.position,
        projectIndex
    );
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
    return getReferencesToSymbolAt(
        params.textDocument.uri,
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
 * Fetch a file from the client.
 *
 * @param uri URI of the document to fetch.
 * @param [langId="twee3"] The language ID for the resulting text document.
 * @returns A text document containing the file's contents, or undefined if we weren't able to read it.
 */
async function fetchFile(
    uri: string,
    langId: string = "twee3"
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
 * Parse a document.
 *
 * This does not update the diagnostics.
 *
 * @param document Document to process.
 * @param parseLevel What level of parsing to do.
 * @param diagnosticsOptions Diagnostic options.
 * @param reindexOnStoryFormatChange If true and the story format changes, re-index all project files.
 */
async function parseTextDocument(
    document: TextDocument,
    parseLevel: ParseLevel,
    diagnosticsOptions: DiagnosticsOptions | undefined,
    reindexOnStoryFormatChange: boolean
) {
    if (diagnosticsOptions === undefined) {
        // We'll only get the diagnostic options if we're parsing passage
        // contents, since otherwise we're just collecting passage names
        if (parseLevel === ParseLevel.Full) {
            const settings = await getSettings();
            diagnosticsOptions = settings["twee-3"];
        } else {
            diagnosticsOptions = defaultDiagnosticsOptions;
        }
    }

    // Keep track of the story title and format so, if either changes, we can notify
    // listeners and (optionally, for changed story format) request a full re-index
    const storyTitle = projectIndex.getStoryTitle();
    const storyFormat = projectIndex.getStoryData()?.storyFormat;

    updateProjectIndex(document, parseLevel, projectIndex, diagnosticsOptions);

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
            Heartbeat.indexWorkspace();
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
        getSugarCubeMacroInfo()
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
        Heartbeat.indexSugarCubeMacros();
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
            isYaml
        );
        if (parsedResults.macrosAndEnums !== undefined) {
            setCustomMacrosAndEnums(uri, parsedResults.macrosAndEnums);
        }
        if (parsedResults.errors.length) {
            const diagnostics = [
                Diagnostic.create(
                    Range.create(0, 0, 1, 0),
                    `Problems with the configuration file: ${parsedResults.errors.join("\n")}`
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
    const settings = await getSettings();
    const diagnosticsOptions = settings["twee-3"];

    // Loop through twice since validation can depend on the result of parsing all docs
    for (const doc of documents.all()) {
        await parseTextDocument(doc, ParseLevel.Full, diagnosticsOptions, true);
    }
    for (const doc of documents.all()) {
        await validateTextDocument(doc, diagnosticsOptions);
    }

    // Request that the client re-do diagnostics since we've re-processed
    connection.languages.diagnostics.refresh();
}

/**
 * Validate a document and get any diagnostics arising from that validation.
 *
 * @param textDocument Document to validate.
 * @param diagnosticsOptions Diagnostics options.
 */
async function validateTextDocument(
    textDocument: TextDocument,
    diagnosticsOptions: DiagnosticsOptions | undefined
) {
    if (diagnosticsOptions === undefined) {
        diagnosticsOptions = (await getSettings())["twee-3"];
    }

    const diagnostics = await generateDiagnostics(
        textDocument,
        projectIndex,
        diagnosticsOptions
    );

    connection.sendDiagnostics({ uri: textDocument.uri, diagnostics });
}

// Make the text document manager listen on the connection
// for open, change and close text document events
documents.listen(connection);

// Listen on the connection
connection.listen();
