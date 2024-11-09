import * as path from "path";
import {
    languages,
    window,
    workspace,
    Disposable,
    ExtensionContext,
    IndentAction,
    OnEnterRule,
    TextDocument,
    TextEditor,
    Uri,
} from "vscode";
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
import { Configuration } from "./constants";
import * as notifications from "./notifications";
import { storyFormatToLanguageID } from "./manage-storyformats";
import { VSCodeWorkspaceProvider } from "./vscode-workspace-provider";
import { checkForLocalStoryFormat } from "./build-system";

let client: LanguageClient;
let currentStoryFormat: StoryFormat;
let currentStoryFormatLanguageID: string;
let currentStoryFormatLanguageConfiguration: Disposable | undefined; // Any current language settings

const workspaceProvider = new VSCodeWorkspaceProvider();

/**
 * Update the cached story format language based on the value in currentStoryFormat.
 * @returns True if the story format language changed; false otherwise.
 */
async function _updateStoryFormatLanguage(): Promise<boolean> {
    const previousStoryFormatLanguage = currentStoryFormatLanguageID;
    currentStoryFormatLanguageID = storyFormatToLanguageID(
        currentStoryFormat,
        await languages.getLanguages()
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
async function _updateTweeDocumentLanguage(
    document: TextDocument
): Promise<TextDocument> {
    // N.B. that currentStoryFormatLanguage may not be set due to
    // the parser not yet having encountered the StoryData passage
    if (
        currentStoryFormatLanguageID !== undefined &&
        /^twee3.*/.test(document.languageId) &&
        document.languageId !== currentStoryFormatLanguageID
    ) {
        return await languages.setTextDocumentLanguage(
            document,
            currentStoryFormatLanguageID
        );
    }
    return document;
}

async function _onUpdatedStoryFormat(e: StoryFormat) {
    // Let's bounce if the story format hasn't changed
    if (
        e.format === currentStoryFormat?.format &&
        e.formatVersion === currentStoryFormat?.formatVersion
    ) {
        return;
    }

    currentStoryFormat = e;
    if (await _updateStoryFormatLanguage()) {
        // If the story format ID changed, get rid of any previous language configuration.
        if (currentStoryFormatLanguageConfiguration) {
            currentStoryFormatLanguageConfiguration.dispose();
            currentStoryFormatLanguageConfiguration = undefined;
        }
    }
    // If we have an active text window, adjust its language if necessary
    if (window.activeTextEditor !== undefined) {
        _updateTweeDocumentLanguage(window.activeTextEditor.document);
    }

    checkForLocalStoryFormat(currentStoryFormat, workspaceProvider);
}

async function _onUpdatedSugarCube2MacroInfo(e: SC2MacroInfo[]) {
    // Create a bunch of onEnterRules to indent/outdent container macros and kids
    const onEnterRules: OnEnterRule[] = [];
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
                        indentAction: IndentAction.IndentOutdent,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2CloseContainerMacroPattern(info.name),
                        "gm"
                    ),
                    action: {
                        indentAction: IndentAction.None,
                    },
                },
                {
                    beforeText: new RegExp(
                        createSC2OpenContainerMacroPattern(info.name),
                        "gm"
                    ),
                    action: {
                        indentAction: IndentAction.Indent,
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
                    indentAction: IndentAction.Indent,
                },
            });
        }
    }

    currentStoryFormatLanguageConfiguration =
        languages.setLanguageConfiguration(currentStoryFormatLanguageID, {
            onEnterRules: onEnterRules,
        });
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

export function activate(context: ExtensionContext) {
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
            fileEvents: workspace.createFileSystemWatcher(
                "**/*.twee-config.{json,yaml,yml}"
            ),
        },
    };

    // Create the language client and start the client.
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
        async (e) => await _onUpdatedStoryFormat(e[0])
    );
    notifications.addNotificationHandler(
        CustomMessages.UpdatedSugarCubeMacroList,
        async (e) => await _onUpdatedSugarCube2MacroInfo(e[0])
    );

    // Handle configuration changes
    workspace.onDidChangeConfiguration((e) => {
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
    window.onDidChangeActiveTextEditor(async (e: TextEditor | undefined) => {
        if (e !== undefined) {
            await _updateTweeDocumentLanguage(e.document);
        }
    });

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
                await workspaceProvider.fs.readFile(Uri.parse(args.uri))
            );
        }
    );

    // Start the client. This will also launch the server
    client.start();
}

export function deactivate(): Thenable<void> | undefined {
    if (!client) {
        return undefined;
    }
    return client.stop();
}
