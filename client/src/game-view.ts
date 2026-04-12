import * as vscode from "vscode";
import { Utils as UriUtils } from "vscode-uri";

import {
    Configuration,
    CustomWhenContext,
    RunningGameUpdateOptions,
} from "./constants";
import { addListener, signalContextEvent } from "./context";

let panel: vscode.WebviewPanel | undefined;
let gameUri: vscode.Uri;
let panelDisposables: vscode.Disposable[] = [];

/**
 * Determine if a game is running.
 * @returns True if the game is running.
 */
export function gameRunning(): boolean {
    return panel !== undefined;
}

/**
 * Commands between the game webview and the extension.
 */
enum WebviewMessageCommands {
    Reload = "twine-iframe-requests-reload", // Request from iframe to reload
    ResetState = "twine-extension-requests-state-reset", // Request from extension to reset story state
}

/**
 * Prepare raw HTML to be displayed in a webview.
 *
 * Handles security policies, updating Javascript calls that won't
 * work properly in the webview's iframe, and makes references to
 * local files refer instead to webview-allowed URIs.
 *
 * @param rootUri Root URI to local file resources.
 * @param src HTML source.
 * @param context Extension context.
 * @returns Webviewified HTML.
 */
function webviewifyHtml(
    rootUri: vscode.Uri,
    src: string,
    context: vscode.ExtensionContext,
): string {
    const cspSource = panel?.webview.cspSource || "";

    // Create a content security policy, even though it's super lenient.
    // (It has to be, since e.g. SugarCube 2 uses `eval()`, sigh.)
    const securityPolicies = {
        "default-src": ["'none'"],
        "img-src": [cspSource, "data:", "https:", "blob:"],
        "media-src": [cspSource, "data:", "https:", "blob:"],
        "font-src": [cspSource, "data:", "https:"],
        "style-src": [cspSource, "https:", "'unsafe-inline'"],
        "script-src": [cspSource, "https:", "'unsafe-inline'", "'unsafe-eval'"],
        "connect-src": [cspSource, "https:", "data:"],
    };
    const securityPoliciesContent = Object.entries(securityPolicies)
        .map(([k, v]) => `${k} ${v.join(" ")}`)
        .join("; ");
    const securityPolicyTag = `<meta http-equiv="Content-Security-Policy" content="${securityPoliciesContent}"/>`;

    // Some story formats use `window.location.reload()` to restart. Since that
    // erases the entire webview, add a function to send a message requesting
    // reload that can take the place of the reload() call.
    // Also, SugarCube and Chapbook save state in ways that survives a reload().
    // Add a function that, when it receives a message from the extension, tries
    // to reset SugarCube/Chapbook state.
    const customScriptTag = `
<script id="webview-support" type="text/javascript">
const vscode = acquireVsCodeApi();
const requestWebviewReload = () => {
    vscode.postMessage({ command: '${WebviewMessageCommands.Reload}' });
}
window.addEventListener('message', event => {
    if (event.data.command === '${WebviewMessageCommands.ResetState}') {
        try {
            if (typeof SugarCube !== 'undefined' && SugarCube.Engine !== undefined) {
                SugarCube.Engine.restart();
            }
            else if (typeof restart === 'function') {
                restart();
            }
            else {
                requestWebviewReload();
            }
        }
        catch {}
    }
});
</script>`;

    src = src.replace(
        "<head>",
        `<head>\n${securityPolicyTag}\n${customScriptTag}`,
    );

    // Add an invisible timestamp to the end of the body, so we can
    // update it on a re-run and force the webview to refresh.
    src = src.replace(
        "</body>",
        `<div style='display: none;' id='time-cache'>${new Date().getTime()}</div>\n</body>`,
    );

    // Replace window.location.reload() calls with the above-defined messaging fn
    src = src.replace(
        /\bwindow\.location\.reload\(\)/g,
        "requestWebviewReload();",
    );

    if (panel) {
        // Inject a script to re-write all media source links to webview-allowed URIs
        const rootWebviewUri = panel.webview.asWebviewUri(rootUri);
        const scriptUri = panel.webview.asWebviewUri(
            vscode.Uri.joinPath(
                context.extensionUri,
                "dist",
                "client",
                "src",
                "media-rewriter.js",
            ),
        );
        src = src.replace(
            "</body>",
            `
<script>
window.__MEDIA_BASE__ = "${rootWebviewUri.toString()}/";
</script>
<script src="${scriptUri}"></script>
</body>
        `,
        );
    }

    return src;
}

/**
 * Reload a running game from disk and restart it.
 *
 * @param context Extension context.
 */
export async function reloadRunningGame(context: vscode.ExtensionContext) {
    if (panel !== undefined && gameUri !== undefined) {
        viewCompiledGame(gameUri, true, context);
    }
}

/**
 * View a compiled game in a webview.
 *
 * @param htmlUri URI to the local HTML file.
 * @param restart Whether to restart the game or not.
 * @param context Extension context.
 */
export async function viewCompiledGame(
    htmlUri: vscode.Uri,
    restart: boolean = false,
    context: vscode.ExtensionContext,
) {
    gameUri = htmlUri;

    try {
        if (!panel) {
            // Limit to our workspace only and our injected media-rewriting script
            const resourceRoots: vscode.Uri[] = [context.extensionUri];

            if (vscode.workspace.workspaceFolders) {
                resourceRoots.push(vscode.workspace.workspaceFolders[0].uri);
            }
            panel = vscode.window.createWebviewPanel(
                "TwineGameView",
                "Game",
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: resourceRoots,
                },
            );
            panel.webview.onDidReceiveMessage(
                (message) => {
                    if (
                        message.command === WebviewMessageCommands.Reload &&
                        panel
                    ) {
                        // Update the contents to force a reload
                        panel.webview.html = panel.webview.html.replace(
                            /<div style='display: none;' id='time-cache'>.*?<\/div>/g,
                            `<div style='display: none;' id='time-cache'>${new Date().getTime()}</div>`,
                        );
                    }
                },
                undefined,
                panelDisposables,
            );
            signalContextEvent("runStarts");
            await vscode.commands.executeCommand(
                "setContext",
                CustomWhenContext.Running,
                true,
            );
            panel.onDidDispose(() => {
                panel = undefined;
                for (const d of panelDisposables) {
                    d.dispose();
                }
                panelDisposables = [];
                // When we're disposed, we're no longer running a game
                signalContextEvent("runEnds");
                vscode.commands.executeCommand(
                    "setContext",
                    CustomWhenContext.Running,
                    false,
                );
            });
            panelDisposables.push(
                addListener("buildSuccessful", (params) => {
                    const updateOption = vscode.workspace
                        .getConfiguration(Configuration.BaseSection)
                        .get(
                            Configuration.RunningGameUpdate,
                        ) as RunningGameUpdateOptions;
                    if (updateOption !== "no update") {
                        const restart = updateOption === "restart";
                        viewCompiledGame(params[0], restart, context);
                    }
                }),
            );
        }

        const htmlContents = webviewifyHtml(
            UriUtils.dirname(htmlUri),
            (await vscode.workspace.fs.readFile(htmlUri)).toString(),
            context,
        );

        // Get the game's name from the <tw-storydata> tag
        let gameTitle = "Game";
        const m = /<tw-storydata [^>]*?name=(["'])(.*?)\1/.exec(htmlContents);
        if (m) {
            gameTitle = m[2];
        }

        panel.title = gameTitle;
        panel.webview.html = htmlContents;
        if (restart) {
            await panel?.webview.postMessage({
                command: WebviewMessageCommands.ResetState,
            });
        }
        panel.reveal();
    } catch (error) {
        const message =
            error instanceof Error ? error.message : "Unknown error";
        vscode.window.showErrorMessage(
            `Could not open the compiled Twine game at ${htmlUri}: ${message}`,
        );
    }
}
