import * as path from "path";
import * as vscode from "vscode";
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
    checkForLocalStoryFormat,
    checkForProjectDirectories,
    getBuildAndStoryUris,
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
import { Configuration, CustomCommands } from "./constants";
import { viewCompiledGame } from "./game-view";
import {
    cacheStoryFormat,
    getCachedStoryFormat,
    storyFormatToLanguageID,
} from "./manage-storyformats";
import * as notifications from "./notifications";
import { createStatusBarItems } from "./status-bar-items";
import { TwineTaskProvider } from "./tasks";
import { VSCodeWorkspaceProvider } from "./vscode-workspace-provider";

let client: LanguageClient;
let currentStoryTitle: string;
let currentStoryFormatLanguageID: string;
let currentStoryFormatLanguageConfiguration: vscode.Disposable | undefined; // Any current language settings

const workspaceProvider = new VSCodeWorkspaceProvider();

/**
 * Register the extension's custom commands.
 *
 * @param context Context to manage the commands.
 */
function registerCommands(context: vscode.ExtensionContext) {
    const commands = [
        vscode.commands.registerCommand(CustomCommands.BuildGame, () =>
            build({}, workspaceProvider)
        ),
        vscode.commands.registerCommand(CustomCommands.BuildGameTest, () =>
            build({ debug: true }, workspaceProvider)
        ),
        vscode.commands.registerCommand(CustomCommands.RunGame, () => {
            const { story } = getBuildAndStoryUris(
                workspaceProvider,
                currentStoryTitle
            );
            viewCompiledGame(story);
        }),
        vscode.commands.registerCommand(
            CustomCommands.DownloadStoryFormat,
            () => {
                const format = getCachedStoryFormat();
                if (format === undefined) {
                    vscode.window.showErrorMessage(
                        `Can't download the project's Twine story format because it isn't known`
                    );
                } else {
                    checkForLocalStoryFormat(
                        format.format,
                        true,
                        workspaceProvider
                    );
                }
            }
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
    format: StoryFormat
): Promise<boolean> {
    const previousStoryFormatLanguage = currentStoryFormatLanguageID;
    currentStoryFormatLanguageID = storyFormatToLanguageID(
        format,
        await vscode.languages.getLanguages()
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
    document: vscode.TextDocument
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
            currentStoryFormatLanguageID
        );
    }
    return document;
}

async function onUpdatedStoryFormat(e: StoryFormat) {
    // Let's bounce if the story format hasn't changed
    const oldFormat = getCachedStoryFormat()?.format;
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
    checkForLocalStoryFormat(e, false, workspaceProvider).then(() =>
        cacheStoryFormat(e, workspaceProvider)
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
                        "gm"
                    ),
                    afterText: new RegExp(
                        createSC2CloseContainerMacroPattern(info.name),
                        "gm"
                    ),
                    action: {
                        indentAction: vscode.IndentAction.IndentOutdent,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2CloseContainerMacroPattern(info.name),
                        "gm"
                    ),
                    action: {
                        indentAction: vscode.IndentAction.None,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2OpenContainerMacroPattern(info.name),
                        "gm"
                    ),
                    action: {
                        indentAction: vscode.IndentAction.Indent,
                    },
                }
            );
        }
        if (info.isChild) {
            onEnterRules.push({
                beforeText: new RegExp(
                    createSC2OpenContainerMacroPattern(info.name),
                    "gm"
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
            }
        );
}

const storyFilesGlob = (): string => {
    let dir = workspaceProvider.getConfigurationItem<string>(
        Configuration.BaseSection,
        Configuration.StoryFilesDirectory
    );
    if (!dir.endsWith("/")) {
        dir += "/";
    }
    return dir + "**/**.{tw,twee}";
};

export function activate(context: vscode.ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join("dist", "server", "src", "server.js")
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
                "**/*.twee-config.{json,yaml,yml}"
            ),
        },
    };

    // Create the language client
    client = new LanguageClient(
        "twineChapbook",
        "Twine Chapbook",
        serverOptions,
        clientOptions
    );

    // Handle notifications
    context.subscriptions.push(notifications.initNotifications(client));
    notifications.addNotificationHandler(
        CustomMessages.UpdatedStoryTitle,
        (e) => (currentStoryTitle = e[0])
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedStoryFormat,
        async (e) => await onUpdatedStoryFormat(e[0])
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedSugarCubeMacroList,
        async (e) => await onUpdatedSugarCube2MacroInfo(e[0])
    );

    // Handle configuration changes
    context.subscriptions.push(
        vscode.workspace.onDidChangeConfiguration((e) => {
            // If the user changes what directories include story files, request a re-index
            if (
                e.affectsConfiguration(
                    `${Configuration.BaseSection}.${Configuration.StoryFilesDirectory}`
                )
            ) {
                client.sendNotification(CustomMessages.RequestReindex);
            }
        })
    );

    // Adjust document languages on edit if needed
    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(
            async (e: vscode.TextEditor | undefined) => {
                if (e !== undefined) {
                    await updateTweeDocumentLanguage(e.document);
                }
            }
        )
    );

    // Handle file requests
    client.onRequest(FindTweeFilesRequest, async () => {
        return (await workspaceProvider.findFiles(storyFilesGlob())).map((f) =>
            f.toString()
        );
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
                await workspaceProvider.fs.readFile(vscode.Uri.parse(args.uri))
            );
        }
    );

    // Register our custom commands
    registerCommands(context);

    // Register our custom tasks
    context.subscriptions.push(
        vscode.tasks.registerTaskProvider(
            TwineTaskProvider.TwineBuildScriptType,
            new TwineTaskProvider()
        )
    );

    // Set up our status bar items
    createStatusBarItems(context);

    // If a text document changes, see if we need to clear annotations
    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument(clearAnnotationOnChangeEvent)
    );

    // Start the client. This will also launch the server
    client.start().then(() => checkForProjectDirectories(workspaceProvider));
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
