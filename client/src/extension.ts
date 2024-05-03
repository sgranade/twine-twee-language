import * as path from "path";
import { workspace, ExtensionContext } from "vscode";

import {
    LanguageClient,
    LanguageClientOptions,
    ServerOptions,
    TransportKind,
} from "vscode-languageclient/node";

import { CustomMessages, StoryFormat } from "./client-server";
import * as notifications from "./notifications";

let client: LanguageClient;
let currentStoryFormat: StoryFormat;

function _onUpdatedStoryFormat(e: StoryFormat): void {
    currentStoryFormat = e;
}

export function activate(context: ExtensionContext) {
    // The server is implemented in node
    const serverModule = context.asAbsolutePath(
        path.join("server", "out", "server.js")
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
        // Register the server for plain text documents
        documentSelector: [{ scheme: "file", language: "twee3" }],
        synchronize: {
            // Notify the server about file changes to '.clientrc files contained in the workspace
            fileEvents: workspace.createFileSystemWatcher("**/.clientrc"),
        },
    };

    // Create the language client and start the client.
    client = new LanguageClient(
        "twineChapbook",
        "Twine Chapbook",
        serverOptions,
        clientOptions
    );

    // Be ready to handle notifications
    context.subscriptions.push(notifications.initNotifications(client));

    notifications.addNotificationHandler(
        CustomMessages.UpdatedStoryFormat,
        (e) => _onUpdatedStoryFormat(e[0])
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
