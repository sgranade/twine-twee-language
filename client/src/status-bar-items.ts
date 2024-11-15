import * as vscode from "vscode";

export const enum StatusBarItemIDs {
    Building = "twine_building",
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
    buildingStatusBarItem.text = "$(sync~spin) Building Twine game";
    buildingStatusBarItem.hide();
    statusBarItems[StatusBarItemIDs.Building] = buildingStatusBarItem;

    context.subscriptions.push(...Object.values(statusBarItems));
}

/**
 * Change a status bar item's visibility.
 *
 * @param id ID of the status bar item.
 * @param visible Whether the item should be visible (true) or not.
 */
export function statusBarItemVisibility(
    id: StatusBarItemIDs,
    visible: boolean
) {
    let item = statusBarItems[id];
    if (visible) {
        item?.show();
    } else {
        item?.hide();
    }
}
