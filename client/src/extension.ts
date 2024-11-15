import * as path from "path";
import * as vscode from "vscode";
import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
    URI,
} from "vscode-languageclient/node";

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
import * as notifications from "./notifications";
import { storyFormatToLanguageID } from "./manage-storyformats";
import { VSCodeWorkspaceProvider } from "./vscode-workspace-provider";
import {
    build,
    checkForLocalStoryFormat,
    checkForProjectDirectories,
} from "./build-system";
import { createStatusBarItems } from "./status-bar-items";

let client: LanguageClient;
let currentStoryFormat: StoryFormat;
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
        vscode.commands.registerCommand(
            CustomCommands.DownloadStoryFormat,
            () =>
                checkForLocalStoryFormat(
                    currentStoryFormat,
                    true,
                    workspaceProvider
                )
        ),
    ];

    context.subscriptions.push(...commands);
}

/**
 * Update the cached story format language based on the value in currentStoryFormat.
 * @returns True if the story format language changed; false otherwise.
 */
async function updateStoryFormatLanguage(): Promise<boolean> {
    const previousStoryFormatLanguage = currentStoryFormatLanguageID;
    currentStoryFormatLanguageID = storyFormatToLanguageID(
        currentStoryFormat,
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
    if (
        e.format === currentStoryFormat?.format &&
        e.formatVersion === currentStoryFormat?.formatVersion
    ) {
        return;
    }

    currentStoryFormat = e;
    if (await updateStoryFormatLanguage()) {
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
    // already been downloaded
    checkForLocalStoryFormat(currentStoryFormat, false, workspaceProvider);
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

const includeFiles = (): string =>
    workspaceProvider.getConfigurationItem(
        Configuration.BaseSection,
        Configuration.FilesInclude
    ) as string;
const excludeFiles = (): string =>
    workspaceProvider.getConfigurationItem(
        Configuration.BaseSection,
        Configuration.FilesExclude
    ) as string;

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
        CustomMessages.UpdatedStoryFormat,
        async (e) => await onUpdatedStoryFormat(e[0])
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedSugarCubeMacroList,
        async (e) => await onUpdatedSugarCube2MacroInfo(e[0])
    );

    // Handle configuration changes
    vscode.workspace.onDidChangeConfiguration((e) => {
        // If the user changes what files to include or exclude, request a re-index
        if (
            e.affectsConfiguration(
                `${Configuration.BaseSection}.${Configuration.FilesInclude}`
            ) ||
            e.affectsConfiguration(
                `${Configuration.BaseSection}.${Configuration.FilesExclude}`
            )
        ) {
            client.sendNotification(CustomMessages.RequestReindex);
        }
    });

    // Adjust document languages on edit if needed
    vscode.window.onDidChangeActiveTextEditor(
        async (e: vscode.TextEditor | undefined) => {
            if (e !== undefined) {
                await updateTweeDocumentLanguage(e.document);
            }
        }
    );

    // Handle file requests
    client.onRequest(FindTweeFilesRequest, async () => {
        return (
            await workspaceProvider.findFiles(includeFiles(), excludeFiles())
        ).map((f) => f.toString());
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

    // Set up our status bar items
    createStatusBarItems(context);

    // Start the client. This will also launch the server
    client.start().then(() => checkForProjectDirectories(workspaceProvider));
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
