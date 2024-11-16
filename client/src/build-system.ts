import * as vscode from "vscode";
import { URI, Utils as UriUtils } from "vscode-uri";

import { addTrailingAnnotation } from "./annotations";
import { StoryFormat } from "./client-server";
import { Configuration, CustomWhenContext } from "./constants";
import {
    downloadStoryFormat,
    localStoryFormatExists,
    readLocalStoryFormat,
    StoryFormatDownloadSupport,
    storyFormatSupportsDownloading,
    storyFormatToWorkspacePath,
} from "./manage-storyformats";
import { StatusBarItemIDs, statusBarItemVisibility } from "./status-bar-items";
import { WorkspaceProvider } from "./workspace-provider";
import {
    addFileToStory,
    canAddFileToStory,
    validateStory,
} from "./build/story-loader";
import { compileStory } from "./build/story-output";
import { TweeParseError } from "./build/twee-parser";
import { Story } from "./build/types";

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
 * Remove the ending slash from a string, if it exists.
 *
 * @param str String to remove slash from.
 * @returns String without any ending slash.
 */
function removeEndingSlash(str: string): string {
    if (str.endsWith("/")) {
        return str.slice(0, -1);
    }
    return str;
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
    const storyFilesDirectory = removeEndingSlash(
        config.get(Configuration.StoryFilesDirectory) as string
    );
    const buildDirectory = removeEndingSlash(
        config.get(Configuration.BuildDirectory) as string
    );
    const storyFormatDirectory = removeEndingSlash(
        config.get(Configuration.StoryFormatsDirectory) as string
    );

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
 * @param allowRedownloading If true, allow re-downloading even if it exists.
 * @param workspaceProvider Workspace provider.
 */
export async function checkForLocalStoryFormat(
    storyFormat: StoryFormat,
    allowRedownloading: boolean,
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

    const alreadyDownloaded = await localStoryFormatExists(
        storyFormat,
        workspaceProvider
    );

    // If the story format exists & we don't want to allow
    // re-downloading, then we're done
    if (alreadyDownloaded && !allowRedownloading) {
        return;
    }

    switch (storyFormatSupportsDownloading(storyFormat)) {
        case StoryFormatDownloadSupport.StoryFormatNotSupported:
        case StoryFormatDownloadSupport.BadVersionFormat:
            if (allowRedownloading) {
                // We're trying to re-download it, which only
                // happens at user request, so let them know
                // we can't
                vscode.window.showErrorMessage(
                    `Downloading story format ${storyFormat.format} isn't currently supported`
                );
            }
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
            workspaceProvider.rootWorkspaceUri(),
            storyFormatToWorkspacePath(storyFormat, workspaceProvider) ??
                "format.js"
        );
        try {
            await workspaceProvider.fs.writeFile(outUri, Buffer.from(format));
        } catch (error) {
            vscode.window.showErrorMessage(
                `Could not write the downloaded ${storyFormat.format} file: ${error.message}`
            );
        }
    }
}

/**
 * Build the story, turning it into an HTML file.
 *
 * @param options Options which, if true, are added to the story.
 * @param workspaceProvider Workspace provider
 */
export async function build(
    options: Record<string, boolean>,
    workspaceProvider: WorkspaceProvider
) {
    const rootUri = workspaceProvider.rootWorkspaceUri();
    if (rootUri === undefined) {
        // No workspace has been opened
        return;
    }

    let currentFileUri: URI; // Current file URI
    try {
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            true
        );
        statusBarItemVisibility(StatusBarItemIDs.Building, true);

        // Get all files from the source directory
        const storyFilesDirectory = removeEndingSlash(
            workspaceProvider.getConfigurationItem(
                Configuration.BaseSection,
                Configuration.StoryFilesDirectory
            )
        );
        const allFiles = (
            await workspaceProvider.findFiles(`${storyFilesDirectory}/**`)
        )
            .filter((f) => canAddFileToStory(UriUtils.basename(f)))
            .sort(); // Sort to match Tweego order
        if (allFiles.length === 0) {
            vscode.window.showInformationMessage(
                `Found no files to build in ${storyFilesDirectory}`
            );
            return;
        }

        // Parse all of the files into a Twine story
        const story: Story = { passages: [] };
        for (const fileUri of allFiles) {
            currentFileUri = fileUri;
            const contents = Buffer.from(
                await workspaceProvider.fs.readFile(currentFileUri)
            );
            addFileToStory(story, UriUtils.basename(currentFileUri), contents);
        }

        validateStory(story);

        // Get the story format
        let storyFormatData: string;
        try {
            storyFormatData = await readLocalStoryFormat(
                story.storyData.storyFormat,
                workspaceProvider
            );
        } catch (err) {
            // If it's any error other than "file not found", throw
            if (!err.message.includes("ENOENT")) {
                throw err;
            }

            await vscode.window.showErrorMessage(
                `Couldn't find a local copy of the story format ${story.storyData.storyFormat.format}`
            );
            // Don't await this call so we close the status bar item in the finally clause
            checkForLocalStoryFormat(
                story.storyData.storyFormat,
                true,
                workspaceProvider
            );
            return;
        }

        // Compile to an HTML string
        const html = compileStory(story, storyFormatData, options);

        // Write out the final game
        let buildDir = workspaceProvider
            .getConfigurationItem(
                Configuration.BaseSection,
                Configuration.BuildDirectory
            )
            .trim();
        let storyFilename = workspaceProvider
            .getConfigurationItem(
                Configuration.BaseSection,
                Configuration.OutputFile
            )
            .trim();
        if (!storyFilename) {
            storyFilename = (story.name ?? "story").replace(/ /g, "-");
            if (!storyFilename.endsWith(".")) {
                storyFilename += ".";
            }
            storyFilename += "html";
        }
        const storyUri = UriUtils.joinPath(rootUri, buildDir, storyFilename);
        await workspaceProvider.fs.writeFile(storyUri, Buffer.from(html));
    } catch (err) {
        vscode.window.showErrorMessage(`Build failed: ${err.message}`);
        // If we have a Twee parsing error, try to show the document and annotate the error
        if (err instanceof TweeParseError) {
            const doc = await vscode.workspace.openTextDocument(currentFileUri);
            const editor = await vscode.window.showTextDocument(doc);
            const { line } = doc.positionAt(err.start);
            const range = doc.validateRange(
                new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER)
            );
            editor.revealRange(
                range,
                vscode.TextEditorRevealType.InCenterIfOutsideViewport
            );
            editor.selection = new vscode.Selection(line, 0, line, 0);
            addTrailingAnnotation(editor, line, `Error: ${err.message.trim()}`);
        }
    } finally {
        statusBarItemVisibility(StatusBarItemIDs.Building, false);
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            false
        );
    }
}
