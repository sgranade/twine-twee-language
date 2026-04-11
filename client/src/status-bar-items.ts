import * as vscode from "vscode";

import { CustomCommands } from "./constants";
import { addListener } from "./context";
import { gameRunning } from "./game-view";

export const enum StatusBarItemIDs {
    Building = "twine_building",
    Indexing = "twine_indexing",
    Run = "twine_run",
    Reload = "twine_reload",
}

const statusBarItems: Record<string, vscode.StatusBarItem> = {};

/**
 * Create the extension's status bar items.
 *
 * @param context Context to manage the disposable status bar items.
 */
export function createStatusBarItems(context: vscode.ExtensionContext) {
    // Notification while the game is being built
    const buildingStatusBarItem = vscode.window.createStatusBarItem(
        StatusBarItemIDs.Building,
        vscode.StatusBarAlignment.Left,
        8
    );
    buildingStatusBarItem.name = "Twine Building";
    buildingStatusBarItem.text = "$(sync~spin) Building Twine game...";
    buildingStatusBarItem.hide();
    statusBarItems[StatusBarItemIDs.Building] = buildingStatusBarItem;

    addListener("buildStarts", () => buildingStatusBarItem.show());
    addListener("buildEnds", () => buildingStatusBarItem.hide());

    const runStatusBarItem = vscode.window.createStatusBarItem(
        StatusBarItemIDs.Run,
        vscode.StatusBarAlignment.Left,
        15
    );
    runStatusBarItem.name = "Run Twine Game";
    runStatusBarItem.text = "$(debug-start) Run Twine Game";
    runStatusBarItem.tooltip = "Run project's game";
    runStatusBarItem.command = CustomCommands.RunGame;
    runStatusBarItem.show();
    statusBarItems[StatusBarItemIDs.Run] = runStatusBarItem;

    addListener("buildSuccessful", () => {
        if (!gameRunning()) {
            runStatusBarItem.show();
        }
    });

    const reloadStatusBarItem = vscode.window.createStatusBarItem(
        StatusBarItemIDs.Reload,
        vscode.StatusBarAlignment.Left,
        15
    );
    reloadStatusBarItem.name = "Reload Twine Game";
    reloadStatusBarItem.text = "$(debug-rerun) Reload Twine Game";
    reloadStatusBarItem.tooltip = "Reload project's game";
    reloadStatusBarItem.command = CustomCommands.ReloadGame;
    reloadStatusBarItem.hide();
    statusBarItems[StatusBarItemIDs.Reload] = reloadStatusBarItem;

    // Notification while the game is being indexed
    const indexingStatusBarItem = vscode.window.createStatusBarItem(
        StatusBarItemIDs.Indexing,
        vscode.StatusBarAlignment.Left,
        2
    );
    indexingStatusBarItem.name = "Twine Indexing";
    indexingStatusBarItem.text = "$(sync~spin) Indexing Twine project...";
    indexingStatusBarItem.hide();
    statusBarItems[StatusBarItemIDs.Indexing] = indexingStatusBarItem;

    addListener("indexingStarts", () => indexingStatusBarItem.show());
    addListener("indexingEnds", () => indexingStatusBarItem.hide());

    addListener("runStarts", () => {
        runStatusBarItem.hide();
        reloadStatusBarItem.show();
    });
    addListener("runEnds", () => {
        reloadStatusBarItem.hide();
        runStatusBarItem.show();
    });

    context.subscriptions.push(...Object.values(statusBarItems));
}
