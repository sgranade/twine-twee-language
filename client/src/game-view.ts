import * as vscode from "vscode";
import { Utils as UriUtils } from "vscode-uri";

import { addBuildListener } from "./build-system";
import { CustomWhenContext } from "./constants";

let panel: vscode.WebviewPanel | undefined;
let panelDisposables: vscode.Disposable[] = [];

/**
 * Commands between the game webview and the extension.
 */
enum WebviewMessageCommands {
    Reload = "twine-iframe-requests-reload", // Request from iframe to reload
    ResetState = "twine-extension-requests-state-reset", // Request from extension to reset story state
}

/**
 * Turn a file URI or path from an HTML tag into a webview-approved URI.
 *
 * @param rootUri Root URI for local file references.
 * @param uriOrPath Either a full URI or a path (like `path/to/file.css`).
 * @returns Webview-approved URI.
 */
function uriOrPathToWebviewUri(rootUri: vscode.Uri, uriOrPath: string): string {
    try {
        // If it's already a URI, only change it if it's a file URI
        const uri = vscode.Uri.parse(uriOrPath, true);
        if (uri.scheme === "file") {
            // We'll assume the URI's authority is part of the path
            uriOrPath = panel.webview
                .asWebviewUri(
                    vscode.Uri.joinPath(rootUri, uri.authority, uri.path)
                )
                .toString();
        }
    } catch {
        // It's not a URI, so assume it's a raw path
        uriOrPath = panel.webview
            .asWebviewUri(vscode.Uri.joinPath(rootUri, uriOrPath))
            .toString();
    }

    return uriOrPath;
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
 * @returns Webviewified HTML.
 */
function webviewifyHtml(rootUri: vscode.Uri, src: string): string {
    const cspSource = panel?.webview.cspSource || "";

    // Create a content security policy, even though it's super lenient.
    // (It has to be, since e.g. SugarCube 2 uses `eval()`, sigh.)
    const securityPolicies = {
        "default-src": ["'none'"],
        "font-src": [cspSource, "data:", "https:"],
        "img-src": [cspSource, "data:", "https:", "'unsafe-inline'"],
        "script-src": [cspSource, "https:", "'unsafe-inline'", "'unsafe-eval'"],
        "style-src": [cspSource, "https:", "'unsafe-inline'"],
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
        `<head>\n${securityPolicyTag}\n${customScriptTag}`
    );

    // Add an invisible timestamp to the end of the body, so we can
    // update it on a re-run and force the webview to refresh.
    src = src.replace(
        "</body>",
        `<div style='display: none;' id='time-cache'>${new Date().getTime()}</div>\n</body>`
    );

    // Replace window.location.reload() calls with the above-defined messaging fn
    src = src.replace(
        /\bwindow\.location\.reload\(\)/g,
        "requestWebviewReload();"
    );

    // Turn src, href, and URL() references into webview URIs
    src = src.replace(
        /(src|href)="(file:.*?|(?:[\w\-._~/]|%[0-9a-fA-F]{2})*?)"/g,
        (_substr, attribute, uriOrPath) =>
            `${attribute}="${uriOrPathToWebviewUri(rootUri, uriOrPath)}`
    );
    src = src.replace(
        /url\(("?)((?:[\w\-._~/]|%[0-9a-fA-F]{2})*?)\1\)/g,
        (_substr, quote, uriOrPath) =>
            `url(${quote}${uriOrPathToWebviewUri(rootUri, uriOrPath)}${quote})`
    );

    return src;
}

/**
 * Reload a running game.
 */
export async function reloadRunningGame() {
    await panel?.webview.postMessage({
        command: WebviewMessageCommands.ResetState,
    });
}

/**
 * Update timestamp in a compiled game to make the webview contents look different.
 */
function updateRunningGameTimestamp() {
    if (panel !== undefined) {
        // Update the contents to force a reload
        panel.webview.html = panel.webview.html.replace(
            /<div style='display: none;' id='time-cache'>.*?<\/div>/g,
            `<div style='display: none;' id='time-cache'>${new Date().getTime()}</div>`
        );
    }
}

/**
 * View a compiled game in a webview.
 *
 * @param htmlUri URI to the local HTML file.
 */
export async function viewCompiledGame(htmlUri: vscode.Uri) {
    try {
        if (!panel) {
            panel = vscode.window.createWebviewPanel(
                "TwineGameView",
                "Game",
                vscode.ViewColumn.Beside,
                {
                    enableScripts: true,
                    localResourceRoots: [
                        vscode.workspace.workspaceFolders[0].uri,
                    ], // Limit to our workspace only
                }
            );
            panel.webview.onDidReceiveMessage(
                (message) => {
                    if (message.command === WebviewMessageCommands.Reload) {
                        updateRunningGameTimestamp();
                    }
                },
                undefined,
                panelDisposables
            );
            await vscode.commands.executeCommand(
                "setContext",
                CustomWhenContext.Running,
                true
            );
            panel.onDidDispose(() => {
                panel = undefined;
                for (const d of panelDisposables) {
                    d.dispose();
                }
                panelDisposables = [];
                // When we're disposed, we're no longer running a game
                vscode.commands.executeCommand(
                    "setContext",
                    CustomWhenContext.Running,
                    false
                );
            });
            panelDisposables.push(
                addBuildListener((uri) => viewCompiledGame(uri))
            );
        }

        const htmlContents = webviewifyHtml(
            UriUtils.dirname(htmlUri),
            (await vscode.workspace.fs.readFile(htmlUri)).toString()
        );

        // Get the game's name from the <tw-storydata> tag
        let gameTitle = "Game";
        const m = /<tw-storydata [^>]*?name=(["'])(.*?)\1/.exec(htmlContents);
        if (m) {
            gameTitle = m[2];
        }

        panel.title = gameTitle;
        panel.webview.html = htmlContents;
        panel.reveal();
    } catch (error) {
        vscode.window.showErrorMessage(
            `Could not open the compiled Twine game at ${htmlUri}: ${error.message}`
        );
    }
}
