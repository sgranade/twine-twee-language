import * as vscode from "vscode";
import { URI, Utils as UriUtils } from "vscode-uri";

import { addTrailingAnnotation } from "./annotations";
import { StoryFormat } from "./client-server";
import { Configuration, CustomWhenContext } from "./constants";
import {
    downloadStoryFormat,
    getCachedStoryFormat,
    localStoryFormatExists,
    readLocalStoryFormat,
    StoryFormatDownloadSupport,
    storyFormatSupportsDownloading,
    storyFormatToWorkspacePath,
} from "./manage-storyformats";
import { WorkspaceProvider } from "./workspace-provider";
import {
    addFileToStory,
    canAddFileToStory,
    validateStory,
} from "./build/story-loader";
import { compileStory } from "./build/story-output";
import { TweeParseError } from "./build/twee-parser";
import { Story } from "./build/types";
import { signalContextEvent } from "./context";

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

interface BuildDirAndStoryUris {
    /**
     * URI to the build directory.
     */
    build: URI;
    /**
     * URI to the story file.
     */
    story: URI;
}

/**
 * Get URIs to the build directory and story file.
 *
 * @param workspaceProvider Workspace provider.
 * @param storyName Name (title) of the story, if known.
 * @returns URIs to the build directory and story file.
 */
export function getBuildAndStoryUris(
    workspaceProvider: WorkspaceProvider,
    storyName?: string
): BuildDirAndStoryUris {
    const buildDir = workspaceProvider
        .getConfigurationItem<string>(
            Configuration.BaseSection,
            Configuration.BuildDirectory
        )
        .trim();
    let storyFilename = workspaceProvider
        .getConfigurationItem<string>(
            Configuration.BaseSection,
            Configuration.OutputFile
        )
        .trim();
    if (!storyFilename) {
        storyFilename = (storyName ?? "story").replace(/ /g, "-");
        if (!storyFilename.endsWith(".")) {
            storyFilename += ".";
        }
        storyFilename += "html";
    }
    const buildDirUri = UriUtils.joinPath(
        workspaceProvider.rootWorkspaceUri(),
        buildDir
    );
    const storyUri = UriUtils.joinPath(buildDirUri, storyFilename);
    return { build: buildDirUri, story: storyUri };
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
    const projectDirs = [
        Configuration.StoryFormatsDirectory,
        Configuration.StoryFilesDirectory,
        Configuration.IncludeDirectory,
        Configuration.BuildDirectory,
    ].map((key) => removeEndingSlash(config.get(key) as string));

    const directoriesExist: Record<string, boolean> = {};
    for (const d of projectDirs) {
        await recordDirectoryExistence(
            d,
            rootUri,
            directoriesExist,
            workspaceProvider
        );
    }
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
                "The story format in the :: StoryData passage has no format-version, limiting the available support"
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
 * Reads a story format from a local copy or asks the user to download if it doesn't exist.
 *
 * If the story format isn't found and the user's prompted about whether
 * or not to download it, this function doesn't wait for that response.
 *
 * @param storyFormat Story format to read from the local cache.
 * @param workspaceProvider Workspace provider.
 * @returns Story format contents as a string, or undefined if it couldn't be read.
 * @throws Error if the format can't be read for any reason other than it not being found.
 */
export async function readLocalStoryFormatOrAskToDownload(
    storyFormat: StoryFormat,
    workspaceProvider: WorkspaceProvider
): Promise<string | undefined> {
    try {
        return await readLocalStoryFormat(storyFormat, workspaceProvider);
    } catch (err) {
        // If it's any error other than "file not found", throw
        if (!err.message.includes("ENOENT")) {
            throw err;
        }

        await vscode.window.showErrorMessage(
            `Couldn't find a local copy of the story format ${storyFormat.format}`
        );
        // Don't await this call so we don't wait around for the user to make up their mind
        checkForLocalStoryFormat(storyFormat, true, workspaceProvider);
        return undefined;
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
        let storyFormatData: string;

        // See if we have a cached format
        const cachedStoryFormat = getCachedStoryFormat();
        if (cachedStoryFormat?.contents !== undefined) {
            storyFormatData = cachedStoryFormat.contents;
        }

        signalContextEvent("buildStarts");
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            true
        );

        // Get all files from the source directory
        const storyFilesDirectory = removeEndingSlash(
            workspaceProvider.getConfigurationItem(
                Configuration.BaseSection,
                Configuration.StoryFilesDirectory
            )
        );
        const allFiles = (
            await workspaceProvider.findFiles(
                storyFilesDirectory !== "" ? `${storyFilesDirectory}/**` : "**"
            )
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

        // Get the story format if it hasn't already been gotten or if the newly-parsed
        // story has a different story format than what's cached. (That should never happen,
        // but weirder things have occurred.)
        if (
            cachedStoryFormat === undefined ||
            story.storyData.storyFormat.format !==
                cachedStoryFormat.format.format ||
            story.storyData.storyFormat.formatVersion !==
                cachedStoryFormat.format.formatVersion
        ) {
            const maybeStoryFormatData =
                await readLocalStoryFormatOrAskToDownload(
                    story.storyData.storyFormat,
                    workspaceProvider
                );
            if (maybeStoryFormatData === undefined) {
                // If it's not read, then return
                return;
            }
            storyFormatData = maybeStoryFormatData;
        }

        // Compile to an HTML string
        const html = compileStory(story, storyFormatData, options);

        // Write out the final game
        const outUris = getBuildAndStoryUris(workspaceProvider, story.name);
        await workspaceProvider.fs.writeFile(outUris.story, Buffer.from(html));

        // If the include directory exists and isn't the root directory, copy all files from there into the build folder
        const includeDir = removeEndingSlash(
            workspaceProvider.getConfigurationItem(
                Configuration.BaseSection,
                Configuration.IncludeDirectory
            )
        );
        if (includeDir) {
            // The URI of the include directory assuming it lives in the first workspace
            const includeRootWorkspaceDir = UriUtils.joinPath(
                rootUri,
                includeDir
            ).toString();
            for (const includeFileUri of await workspaceProvider.findFiles(
                includeDir + "/**"
            )) {
                // To replicate the sub-directory structure, we can't just get the filename's
                // basename. Instead, we need to remove the leading directories up to and
                // including the include directory in the workspace.
                let includeFilepath = "ERROR";
                const includeFileStr = includeFileUri.toString();
                // First see if the included file is in the root workspace's include directory
                const ndx = includeFileStr.indexOf(includeRootWorkspaceDir);
                if (ndx !== -1) {
                    includeFilepath = includeFileStr.slice(
                        ndx + includeRootWorkspaceDir.length
                    );
                } else {
                    // As a fallback, try to remove everything before the name of the include
                    // directory, which can give odd results if that name shows up multiple
                    // times in the URI (ex: `file://root/include/fonts/include/font.otf`)
                    includeFilepath = includeFileStr
                        .split(includeDir, 1)
                        .slice(-1)[0];
                }
                await workspaceProvider.fs.copy(
                    includeFileUri,
                    UriUtils.joinPath(outUris.build, includeFilepath),
                    { overwrite: true }
                );
            }
        }

        // Tell everyone our build was successful
        signalContextEvent("buildSuccessful", outUris.story);
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
        signalContextEvent("buildEnds");
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            false
        );
    }
}
