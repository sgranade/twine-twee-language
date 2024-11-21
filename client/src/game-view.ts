import * as vscode from "vscode";
import { Utils as UriUtils } from "vscode-uri";

let panel: vscode.WebviewPanel | undefined;
let panelDisposables: vscode.Disposable[] = [];

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
    const securityPolicy = `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; font-src data: ${cspSource} https:; media-src data: ${cspSource} https:; img-src ${cspSource} 'unsafe-inline' data: ${cspSource} https:; script-src ${cspSource} 'unsafe-inline' 'unsafe-eval' https:; style-src ${cspSource} 'unsafe-inline' https:"/>`;

    // Some story formats use `window.location.reload()` to restart. Since that
    // erases the entire webview, add a function to send a message requesting
    // reload that can take the place of the reload() call.
    const customScript = [
        '<script id="webview-support" type="text/javascript">',
        "const vscode = acquireVsCodeApi();",
        "const requestWebviewReload = () => {",
        "  vscode.postMessage({ command: 'request-iframe-reload' });",
        "}",
        "</script>",
    ].join("\n");

    src = src.replace("<head>", `<head>\n${securityPolicy}\n${customScript}`);

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
                    retainContextWhenHidden: true,
                }
            );
            panel.webview.onDidReceiveMessage(
                (message) => {
                    if (message.command === "request-iframe-reload") {
                        // Update the contents to force a reload
                        panel.webview.html = panel.webview.html.replace(
                            /<div style='display: none;' id='time-cache'>.*?<\/div>/g,
                            `<div style='display: none;' id='time-cache'>${new Date().getTime()}</div>`
                        );
                    }
                },
                undefined,
                panelDisposables
            );
            panel.onDidDispose(() => {
                panel = undefined;
                for (const d of panelDisposables) {
                    d.dispose();
                }
                panelDisposables = [];
            });
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
