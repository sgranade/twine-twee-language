import * as vscode from "vscode";

import { StoryFormat } from "./client-server";
import { Configuration } from "./constants";
import {
    downloadStoryFormat,
    localStoryFormatExists,
    StoryFormatDownloadSupport,
    storyFormatSupportsDownloading,
    storyFormatToWorkspacePath,
} from "./manage-storyformats";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * See if we need to get a local copy of a story format.
 *
 * @param storyFormat Current story format.
 * @param workspaceProvider Workspace provider.
 */
export async function checkForLocalStoryFormat(
    storyFormat: StoryFormat,
    workspaceProvider: WorkspaceProvider
) {
    // If the user doesn't want to download story formats, don't offer
    if (
        !(await workspaceProvider.getConfigurationItem(
            Configuration.BaseSection,
            Configuration.DownloadStoryFormat
        ))
    ) {
        return;
    }

    // If the story format exists, we're good
    if (await localStoryFormatExists(storyFormat, workspaceProvider)) {
        return;
    }

    switch (storyFormatSupportsDownloading(storyFormat)) {
        case StoryFormatDownloadSupport.StoryFormatNotSupported:
        case StoryFormatDownloadSupport.BadVersionFormat:
            return;

        case StoryFormatDownloadSupport.MissingVersion:
            // Give a warning and return
            vscode.window.showInformationMessage(
                "The story format in the :: StoryData passage has no `format-version`, limiting the available support"
            );
            return;
    }

    const selection = await vscode.window.showInformationMessage(
        `Download a local copy of ${storyFormat.format} version ${storyFormat.formatVersion ?? "unknown"}?`,
        "Download",
        "Cancel",
        "Don't Ask Again"
    );

    // Return unless the choice is "Download"
    if (selection !== "Download") {
        if (selection === "Don't Ask Again") {
            // "Don't ask again" -> update the workspace-local configuration
            const config = vscode.workspace.getConfiguration(
                Configuration.BaseSection
            );
            config.update(
                Configuration.DownloadStoryFormat,
                false,
                vscode.ConfigurationTarget.Workspace
            );
        }
        return;
    }

    const format = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: "Downloading Story Format",
            cancellable: false,
        },
        (progress) => downloadStoryFormat(storyFormat)
    );
    if (format instanceof Error) {
        vscode.window.showErrorMessage(
            `Could not download ${storyFormat.format} version ${storyFormat.formatVersion ?? "unknown"}: ${format.message}`
        );
    } else {
        const outUri = vscode.Uri.joinPath(
            vscode.workspace.workspaceFolders[0].uri,
            storyFormatToWorkspacePath(storyFormat, workspaceProvider) ??
                "format.js"
        );
        vscode.workspace.fs.writeFile(outUri, Buffer.from(format));
    }
}
