import * as path from "path";
import * as vscode from "vscode";
import { URI as VSCodeURI, Utils as UriUtils } from "vscode-uri";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    URI,
} from "vscode-languageclient/node";

import { clearAnnotationOnChangeEvent } from "./annotations";
import {
    build,
    downloadLocalStoryFormatIfNeeded,
    buildProjectDirectoriesIfNeeded,
    getBuildAndStoryUris,
    getFilesFromSources,
} from "./build-system";
import {
    createSC2CloseContainerMacroPattern,
    createSC2OpenContainerMacroPattern,
    CustomMessages,
    FindFilesRequest,
    FindTweeFilesRequest,
    ReadFileRequest,
    SC2MacroInfo,
    StoryFormat,
} from "./client-server";
import {
    ConfigFilename,
    currentConfig,
    SupportedStoryFileTypes,
    updateConfig,
    updateConfigFromJson,
    validateConfigDiagnosticCodes,
} from "./config";
import { Configuration, CustomCommands } from "./constants";
import { signalContextEvent } from "./context";
import { setEditorDecorationRanges, updateDecoration } from "./decorations";
import { reloadRunningGame, viewCompiledGame } from "./game-view";
import {
    cachedStoryFormat,
    cacheStoryFormat,
    storyFormatToLanguageID,
} from "./manage-storyformats";
import * as notifications from "./notifications";
import { createStatusBarItems } from "./status-bar-items";
import { TwineTaskProvider } from "./tasks";
import { VSCodeWorkspaceProvider } from "./vscode-workspace-provider";

let client: LanguageClient | undefined;
let currentStoryTitle: string;
let currentStoryFormatLanguageID: string;
let currentStoryFormatLanguageConfiguration: vscode.Disposable | undefined; // Any current language settings
let currentDiagnosticCodes: string[] | undefined;
let projectSetupHandled = false;

const workspaceProvider = new VSCodeWorkspaceProvider();

/**
 * Register the extension's custom commands.
 *
 * @param context Context to manage the commands.
 */
function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand(CustomCommands.BuildGame, () =>
            build({}, workspaceProvider),
        ),
        vscode.commands.registerCommand(CustomCommands.BuildGameTest, () =>
            build({ debug: true }, workspaceProvider),
        ),
        vscode.commands.registerCommand(CustomCommands.RunGame, () => {
            const { story } = getBuildAndStoryUris(
                workspaceProvider,
                currentStoryTitle,
            );
            viewCompiledGame(story, undefined, context);
        }),
        vscode.commands.registerCommand(CustomCommands.ReloadGame, () =>
            reloadRunningGame(context),
        ),
        vscode.commands.registerCommand(
            CustomCommands.DownloadStoryFormat,
            () => {
                if (cachedStoryFormat === undefined) {
                    vscode.window.showErrorMessage(
                        `Can't download the project's Twine story format because it isn't known`,
                    );
                } else {
                    downloadLocalStoryFormatIfNeeded(
                        cachedStoryFormat.format,
                        true,
                        workspaceProvider,
                    );
                }
            },
        ),
    ];

    context.subscriptions.push(...commands);
}

/**
 * Update the cached story format language based on the value in currentStoryFormat.
 *
 * @param format Story format we're updating the story format language to match.
 * @returns True if the story format language changed; false otherwise.
 */
async function updateStoryFormatLanguage(
    format: StoryFormat,
): Promise<boolean> {
    const previousStoryFormatLanguage = currentStoryFormatLanguageID;
    currentStoryFormatLanguageID = storyFormatToLanguageID(
        format,
        await vscode.languages.getLanguages(),
    );
    return currentStoryFormatLanguageID !== previousStoryFormatLanguage;
}

/**
 * If a document is a Twee 3 document, adjust its specific language if needed.
 *
 * This function allows us to adjust document languages for specific
 * Twine story formats.
 *
 * @param document Document whose language might need to be updated.
 * @returns Document.
 */
async function updateTweeDocumentLanguage(
    document: vscode.TextDocument,
): Promise<vscode.TextDocument> {
    // N.B. that currentStoryFormatLanguage may not be set due to
    // the parser not yet having encountered the StoryData passage
    if (
        currentStoryFormatLanguageID !== undefined &&
        /^twee3.*/.test(document.languageId) &&
        document.languageId !== currentStoryFormatLanguageID
    ) {
        return await vscode.languages.setTextDocumentLanguage(
            document,
            currentStoryFormatLanguageID,
        );
    }
    return document;
}

/**
 * Erase all configuration sections: global, workspace, folder.
 *
 * @param config Workspace configuration.
 * @param section Section to erase.
 */
async function eraseAllConfig(
    config: vscode.WorkspaceConfiguration,
    section: string,
) {
    for (const scope of [
        vscode.ConfigurationTarget.Global,
        vscode.ConfigurationTarget.Workspace,
        vscode.ConfigurationTarget.WorkspaceFolder,
    ]) {
        try {
            await config.update(section, undefined, scope);
        } catch {
            // Ignore
        }
    }
}

/**
 * Update a project's configuration from the legacy extension configuration.
 *
 * @returns True if any configuration value changed.
 */
async function updateConfigFromLegacyConfig(): Promise<boolean> {
    const newConfig = currentConfig;
    let configChanged = false;
    const workspaceConfig = vscode.workspace.getConfiguration(
        Configuration.BaseSection,
    );

    const storyFilesDirectory = workspaceConfig.get<string>(
        Configuration.StoryFilesDirectory,
    );
    if (storyFilesDirectory !== undefined) {
        configChanged = true;
        newConfig.build.storySourceFiles = SupportedStoryFileTypes.map(
            (type) => `${storyFilesDirectory}/**/${type}`,
        );
        await eraseAllConfig(
            workspaceConfig,
            Configuration.StoryFilesDirectory,
        );
    }

    const storyFormatsDirectory = workspaceConfig.get<string>(
        Configuration.StoryFormatsDirectory,
    );
    if (storyFormatsDirectory !== undefined) {
        if (
            newConfig.build.storyFormatPaths.length !== 1 ||
            newConfig.build.storyFormatPaths[0] !== storyFormatsDirectory
        ) {
            configChanged = true;
            newConfig.build.storyFormatPaths = [storyFormatsDirectory];
        }
        await eraseAllConfig(
            workspaceConfig,
            Configuration.StoryFormatsDirectory,
        );
    }

    let outputFile = workspaceConfig.get<string>(Configuration.OutputFile);
    if (outputFile !== undefined) {
        // Remember that a blank outputFile === default value (undefined)
        outputFile = outputFile === "" ? undefined : outputFile;
        if (newConfig.build.outputFilename !== outputFile) {
            configChanged = true;
            newConfig.build.outputFilename = outputFile;
        }
        await eraseAllConfig(
            workspaceConfig,
            Configuration.StoryFormatsDirectory,
        );
    }

    const buildDirectory = workspaceConfig.get<string>(
        Configuration.BuildDirectory,
    );
    if (buildDirectory !== undefined) {
        if (newConfig.build.outputPath !== buildDirectory) {
            configChanged = true;
            newConfig.build.outputPath = buildDirectory;
        }
        await eraseAllConfig(workspaceConfig, Configuration.BuildDirectory);
    }

    const includeDirectory = workspaceConfig.get<string>(
        Configuration.IncludeDirectory,
    );
    if (includeDirectory !== undefined) {
        if (
            newConfig.build.includeSourcePaths.length !== 1 ||
            newConfig.build.includeSourcePaths[0] !== includeDirectory
        ) {
            configChanged = true;
            newConfig.build.includeSourcePaths = [includeDirectory];
        }
        await eraseAllConfig(workspaceConfig, Configuration.IncludeDirectory);
    }

    updateConfig(newConfig);

    return configChanged;
}

/**
 * Update the project's configuration from the configuration file.
 *
 * @param uri URI to the configuration file. If undefined, the default URI will be used
 * @returns True if the config file was found; false otherwise.
 */
async function updateConfigFromFile(uri?: VSCodeURI): Promise<boolean> {
    if (!uri) {
        uri = UriUtils.joinPath(
            workspaceProvider.rootWorkspaceUri() ?? VSCodeURI.file("."),
            ConfigFilename,
        );
    }

    try {
        const configContents = new TextDecoder().decode(
            await workspaceProvider.fs.readFile(uri),
        );
        const configError = updateConfigFromJson(
            configContents,
            currentDiagnosticCodes,
        );
        if (configError) {
            vscode.window.showErrorMessage(
                `There are issues with ${ConfigFilename}:\n${configError}`,
            );
        } else {
            // TODO If disabled diagnostics have changed, let the server know
        }
    } catch (e) {
        // If we didn't find the file, let the caller know
        if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") {
            return false;
        } else {
            vscode.window.showErrorMessage(
                `There are issues with ${ConfigFilename}:\n${(e as Error).message}`,
            );
        }
    }

    return true; // The file exists, at least
}

/**
 * Write the current configuration to a file.
 *
 * @param uri URI to write the configuration to. If undefined, the default URI will be used
 */
async function writeConfigToFile(uri?: VSCodeURI) {
    if (!uri) {
        uri = UriUtils.joinPath(
            workspaceProvider.rootWorkspaceUri() ?? VSCodeURI.file("."),
            ConfigFilename,
        );
    }

    let indent = "    ";
    let eol = "\n";
    // See if we can get the indent and line endings from an existing config file
    try {
        const configContents = new TextDecoder().decode(
            await workspaceProvider.fs.readFile(uri),
        );
        const match = configContents.match(/^([ \t]+)(?=\S)/m);
        // Assume the first ever match sets the indent
        if (match?.[1]) {
            indent = match[1];
        }
        // Also get whether the file uses CRLF
        if (configContents.includes("\r\n")) eol = "\r\n";
    } catch (e) {
        if (
            !(e instanceof vscode.FileSystemError) ||
            e.code !== "FileNotFound"
        ) {
            vscode.window.showErrorMessage(
                `Unable to read config file ${ConfigFilename}:\n${(e as Error).message}`,
            );
            return;
        }
    }

    const output =
        JSON.stringify(currentConfig, null, indent).replace("\n", eol) + eol;

    try {
        await workspaceProvider.fs.writeFile(uri, Buffer.from(output));
    } catch (e) {
        vscode.window.showErrorMessage(
            `Unable to save config file ${ConfigFilename}:\n${(e as Error).message}`,
        );
    }
}

async function onUpdatedStoryFormat(e: StoryFormat) {
    // Let's bounce if the story format hasn't changed
    const oldFormat = cachedStoryFormat?.format;
    if (
        e.format === oldFormat?.format &&
        e.formatVersion === oldFormat?.formatVersion
    ) {
        return;
    }

    if (await updateStoryFormatLanguage(e)) {
        // If the story format ID changed, get rid of any previous language configuration.
        if (currentStoryFormatLanguageConfiguration) {
            currentStoryFormatLanguageConfiguration.dispose();
            currentStoryFormatLanguageConfiguration = undefined;
        }
    }
    // If we have an active text window, adjust its language if necessary
    if (vscode.window.activeTextEditor !== undefined) {
        updateTweeDocumentLanguage(vscode.window.activeTextEditor.document);
    }

    // Offer to download the story format, but only if it hasn't
    // already been downloaded. Once done, cache the story format.
    downloadLocalStoryFormatIfNeeded(e, false, workspaceProvider).then(() =>
        cacheStoryFormat(e, workspaceProvider),
    );
}

async function onUpdatedSugarCube2MacroInfo(e: SC2MacroInfo[]) {
    // Create a bunch of onEnterRules to indent/outdent container macros and kids
    const onEnterRules: vscode.OnEnterRule[] = [];
    for (const info of e) {
        if (info.isContainer) {
            onEnterRules.push(
                {
                    beforeText: new RegExp(
                        createSC2OpenContainerMacroPattern(info.name),
                        "gm",
                    ),
                    afterText: new RegExp(
                        createSC2CloseContainerMacroPattern(info.name),
                        "gm",
                    ),
                    action: {
                        indentAction: vscode.IndentAction.IndentOutdent,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2CloseContainerMacroPattern(info.name),
                        "gm",
                    ),
                    action: {
                        indentAction: vscode.IndentAction.None,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2OpenContainerMacroPattern(info.name),
                        "gm",
                    ),
                    action: {
                        indentAction: vscode.IndentAction.Indent,
                    },
                },
            );
        }
        if (info.isChild) {
            onEnterRules.push({
                beforeText: new RegExp(
                    createSC2OpenContainerMacroPattern(info.name),
                    "gm",
                ),
                action: {
                    indentAction: vscode.IndentAction.Indent,
                },
            });
        }
    }

    currentStoryFormatLanguageConfiguration =
        vscode.languages.setLanguageConfiguration(
            currentStoryFormatLanguageID,
            {
                onEnterRules: onEnterRules,
            },
        );
}

/**
 * Set up the TT3 project configuration.
 */
async function setupProjectConfiguration() {
    // Step one: load from config file
    await updateConfigFromFile();

    // Step two: see if there's a legacy config
    const configUpdated = await updateConfigFromLegacyConfig();

    // Step three: if the legacy config changed values, write the new values to the config file
    if (configUpdated) {
        await writeConfigToFile();
    }
}

export function activate(context: vscode.ExtensionContext) {
    // We activate both on workspace load finished and if there's a `.twee` file.
    // In either case we check whether the workspace needs setting up, but we
    // only fully start our server when we detect an open `.twee` file.
    if (!projectSetupHandled) {
        projectSetupHandled = true;
        (async () => {
            await setupProjectConfiguration();
            await buildProjectDirectoriesIfNeeded(workspaceProvider);
        })();
    }

    const tweeFileOpen = vscode.workspace.textDocuments.some(
        (doc) =>
            doc.languageId === "twee3" || doc.languageId.startsWith("twee3-"),
    );
    if (tweeFileOpen) {
        startClient(context);
    } else {
        context.subscriptions.push(
            vscode.workspace.onDidOpenTextDocument((doc) => {
                if (
                    doc.languageId === "twee3" ||
                    doc.languageId.startsWith("twee3-")
                ) {
                    startClient(context);
                }
            }),
        );
    }
}

export function startClient(context: vscode.ExtensionContext) {
    // If the `client` variable exists, we've already started the client
    if (client) {
        return;
    }

    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join("dist", "server", "src", "server.js"),
    );

    // If the extension is launched in debug mode then the debug server options are used
    // Otherwise the run options are used
    const serverOptions: ServerOptions = {
        run: { module: serverModule, transport: TransportKind.ipc },
        debug: {
            module: serverModule,
            transport: TransportKind.ipc,
        },
    };

    // Options to control the language client
    const clientOptions: LanguageClientOptions = {
        documentSelector: [{ scheme: "file", pattern: "**/*.{tw,twee}" }],
        synchronize: {
            // Notify the server about file changes to SugarCube 2 macro definition files
            fileEvents: vscode.workspace.createFileSystemWatcher(
                "**/*.twee-config.{json,yaml,yml}",
            ),
        },
    };

    // Create the language client
    client = new LanguageClient(
        "twineTwee3",
        "Twine (Twee 3)",
        serverOptions,
        clientOptions,
    );

    // Handle notifications
    context.subscriptions.push(notifications.initNotifications(client));
    notifications.addNotificationHandler(
        CustomMessages.UpdatedStoryTitle,
        (e) => (currentStoryTitle = e[0]),
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedStoryFormat,
        async (e) => await onUpdatedStoryFormat(e[0]),
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedSugarCubeMacroList,
        async (e) => await onUpdatedSugarCube2MacroInfo(e[0]),
    );
    notifications.addNotificationHandler(
        CustomMessages.DecorationRanges,
        (e) => {
            if (
                vscode.window.activeTextEditor &&
                vscode.window.activeTextEditor.document.uri.toString() ===
                    e[0].uri
            ) {
                setEditorDecorationRanges(e[0].ranges);
                updateDecoration(vscode.window.activeTextEditor);
            }
        },
    );
    notifications.addNotificationHandler(CustomMessages.IndexingStarted, () =>
        signalContextEvent("indexingStarts"),
    );
    notifications.addNotificationHandler(CustomMessages.IndexingComplete, () =>
        signalContextEvent("indexingEnds"),
    );
    notifications.addNotificationHandler(
        CustomMessages.DiagnosticCodes,
        (e) => {
            currentDiagnosticCodes = e[0].codes;
            if (currentDiagnosticCodes !== undefined) {
                const badCodes = validateConfigDiagnosticCodes(
                    currentDiagnosticCodes,
                );
                if (badCodes !== undefined) {
                    vscode.window.showErrorMessage(
                        `${ConfigFilename} has non-existent diagnostic codes in tt3.disabledDiagnostics:\n${badCodes.join(", ")}`,
                    );
                }
            }
        },
    );
    // Get diagnostic codes from the server
    client.sendNotification(CustomMessages.RequestDiagnosticCodes);

    // If our configuration file changes, update configuration
    const configWatcher = vscode.workspace.createFileSystemWatcher(
        new vscode.RelativePattern(
            (vscode.workspace.workspaceFolders ?? [""])[0],
            ConfigFilename,
        ),
    );
    configWatcher.onDidChange(async (uri) => {
        await updateConfigFromFile(uri);
        // Since the new configuration can change what files are part of the
        // story, request a re-index
        client?.sendNotification(CustomMessages.RequestReindex);
    });
    context.subscriptions.push(configWatcher);

    // Adjust document languages and decorations on editor change if needed
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            async (e: vscode.TextEditor | undefined) => {
                if (e !== undefined) {
                    await updateTweeDocumentLanguage(e.document);
                    client?.sendNotification(
                        CustomMessages.RequestDecorationRanges,
                        e.document.uri.toString(),
                    );
                }
            },
        ),
    );

    // Adjust decorations on text editor selection change
    context.subscriptions.push(
        vscode.window.onDidChangeTextEditorSelection(
            (e: vscode.TextEditorSelectionChangeEvent) => {
                updateDecoration(e.textEditor);
            },
        ),
    );

    // Handle file requests
    client.onRequest(FindTweeFilesRequest, async () => {
        // Get all source files that end in ".tw" or ".twee"
        const files = (
            await getFilesFromSources(
                currentConfig.build.storySourceFiles,
                currentConfig.build.ignores,
                workspaceProvider,
            )
        ).filter((f) => f.path.endsWith(".tw") || f.path.endsWith(".twee"));
        return files.map((f) => f.toString());
    });
    client.onRequest(FindFilesRequest, async (glob: string) => {
        return (
            await workspaceProvider.findFiles(glob, "**/{node_modules,.git}/**")
        ).map((f) => f.toString());
    });
    client.onRequest(
        ReadFileRequest,
        async (args: { uri: URI; encoding?: string }) => {
            return new TextDecoder().decode(
                await workspaceProvider.fs.readFile(vscode.Uri.parse(args.uri)),
            );
        },
    );

    // Register our custom commands
    registerCommands(context);

    // Register our custom tasks
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(
            TwineTaskProvider.TwineBuildScriptType,
            new TwineTaskProvider(),
        ),
    );

    // Set up our status bar items
    createStatusBarItems(context);

    // If a text document changes, see if we need to clear annotations
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(clearAnnotationOnChangeEvent),
    );

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    return client?.stop();
}
