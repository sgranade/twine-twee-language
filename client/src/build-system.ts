import * as vscode from "vscode";
import { URI, Utils as UriUtils } from "vscode-uri";

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
 * Record whether a directory exists in a lookup object.
 *
 * @param dir Workspace-relative directory to check.
 * @param rootUri Root URI to the workspace.
 * @param dirsExist Map of workspace-relative directories to true/false existence.
 * @param workspaceProvider Workspace provider.
 */
async function recordDirectoryExistence(
    dir: string,
    rootUri: URI,
    dirsExist: Record<string, boolean>,
    workspaceProvider: WorkspaceProvider
) {
    const uri = UriUtils.joinPath(rootUri, dir);
    try {
        await workspaceProvider.fs.readDirectory(uri);
        dirsExist[dir] = true;
    } catch (err) {
        if (err.message.includes("ENOENT")) {
            dirsExist[dir] = false;
        } else {
            throw err;
        }
    }
}

/**
 * See if we need to create project directories.
 *
 * @param workspaceProvider Workspace provider.
 */
export async function checkForProjectDirectories(
    workspaceProvider: WorkspaceProvider
) {
    // If the user doesn't want to create project directories, don't offer
    if (
        !workspaceProvider.getConfigurationItem(
            Configuration.BaseSection,
            Configuration.ProjectCreate
        )
    ) {
        return;
    }

    // See if the project directories exist
    const rootUri = workspaceProvider.rootWorkspaceUri();
    if (rootUri === undefined) {
        // No workspace has been opened
        return;
    }

    const config = vscode.workspace.getConfiguration(Configuration.BaseSection);
    const storyFilesDirectory = config.get(
        Configuration.StoryFilesDirectory
    ) as string;
    const buildDirectory = config.get(Configuration.BuildDirectory) as string;
    const storyFormatDirectory = config.get(
        Configuration.StoryFormatsDirectory
    ) as string;

    const directoriesExist: Record<string, boolean> = {};
    await recordDirectoryExistence(
        storyFilesDirectory,
        rootUri,
        directoriesExist,
        workspaceProvider
    );
    await recordDirectoryExistence(
        buildDirectory,
        rootUri,
        directoriesExist,
        workspaceProvider
    );
    await recordDirectoryExistence(
        storyFormatDirectory,
        rootUri,
        directoriesExist,
        workspaceProvider
    );
    if (!Object.values(directoriesExist).includes(false)) {
        // All of the directories exist
        return;
    }

    const selection = await vscode.window.showInformationMessage(
        "Create the project directories for story files, story formats, and built games?",
        "Yes",
        "Cancel",
        "Don't Ask Again"
    );

    // Return unless the choice is "Yes"
    if (selection !== "Yes") {
        if (selection === "Don't Ask Again") {
            // "Don't ask again" -> update the workspace-local configuration
            config.update(
                Configuration.ProjectCreate,
                false,
                vscode.ConfigurationTarget.Workspace
            );
        }
        return;
    }

    for (const [path, exists] of Object.entries(directoriesExist)) {
        if (exists) {
            continue;
        }
        const uri = UriUtils.joinPath(rootUri, path);
        await workspaceProvider.fs.createDirectory(uri);
    }
}

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
        !workspaceProvider.getConfigurationItem(
            Configuration.BaseSection,
            Configuration.DownloadStoryFormat
        )
    ) {
        return;
    }

    // If the story format exists, we're good
    if (localStoryFormatExists(storyFormat, workspaceProvider)) {
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
        () => downloadStoryFormat(storyFormat)
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
