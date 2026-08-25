import * as vscode from "vscode";
import { URI, Utils as UriUtils } from "vscode-uri";

import { StoryFormat } from "@tt3/shared";
import { addTrailingAnnotation } from "./annotations";
import { currentConfig } from "./config";
import { Configuration, CustomWhenContext } from "./constants";
import {
    cachedStoryFormat,
    downloadStoryFormat,
    findLocalStoryFormat,
    readLocalStoryFormat,
    StoryFormatDownloadSupport,
    storyFormatSupportsDownloading,
    workspacePathToWriteStoryFormatTo,
} from "./manage-storyformats";
import { FileType, WorkspaceProvider } from "./workspace-provider";
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
 * Find files that match a source list of globs w/optional ignored patterns.
 * @param sources Files to find as a list of glob patterns.
 * @param ignores Files to be ignored, also as a list of glob patterns.
 * @param workspaceProvider Workspace provider.
 * @returns List of found files.
 */
export async function getFilesFromSources(
    sources: string[],
    ignores: string[] | undefined,
    workspaceProvider: WorkspaceProvider,
): Promise<URI[]> {
    sources = sources.map((source) => source.trim());
    ignores = ignores?.map((ignore) => ignore.trim());

    const joinedSources = !sources.some((p) => p.includes("{"))
        ? "{" + sources.join(",") + "}"
        : undefined;
    // There's no ignores, just sources
    if (ignores === undefined) {
        if (joinedSources) {
            // Simple case: no groups in sources, so we can concatenate them
            return await workspaceProvider.findFiles(joinedSources, null);
        } else {
            // Moderate case: iterate over sources
            const sourceURIs = (
                await Promise.all(
                    sources.map(async (source) => {
                        return await workspaceProvider.findFiles(source, null);
                    }),
                )
            ).flat();
            return [...new Set(sourceURIs)];
        }
    }

    const joinedIgnores = !ignores.some((p) => p.includes("{"))
        ? "{" + ignores.join(",") + "}"
        : undefined;
    // There's ignores, and they can be concatentated
    if (joinedIgnores) {
        if (joinedSources) {
            // Simple case: no groups in sources or ignores
            return await workspaceProvider.findFiles(
                joinedSources,
                joinedIgnores,
            );
        } else {
            // Moderate case: iterate over sources w/a single ignores
            const sourceURIs = (
                await Promise.all(
                    sources.map(async (source) => {
                        return await workspaceProvider.findFiles(
                            source,
                            joinedIgnores,
                        );
                    }),
                )
            ).flat();
            return [...new Set(sourceURIs)];
        }
    }

    // There's ignores, and we need to iterate over them
    if (joinedSources) {
        // Moderate case: iterate over ignores w/a single sources
        const sourceURIs = (
            await Promise.all(
                ignores.map(async (ignore) => {
                    return await workspaceProvider.findFiles(
                        joinedSources,
                        ignore,
                    );
                }),
            )
        ).flat();
        return [...new Set(sourceURIs)];
    } else {
        // Complex case: iterate over sources and ignores
        // (sigh, hello combinatoric explosion)
        // TODO When we target es2024 (starting w/VS Code 1.123 2026-06-03), use Set operations
        const sourceURIs: URI[] = [];
        for (const source of sources) {
            // For any given source, find the set intersection of files
            // that are present in every iteration of `ignores`
            let singleSourceList = await workspaceProvider.findFiles(
                source,
                ignores[0],
            );
            for (const ignore of ignores.slice(1)) {
                const newSourceList = await workspaceProvider.findFiles(
                    source,
                    ignore,
                );
                singleSourceList = singleSourceList.filter((source) =>
                    newSourceList.includes(source),
                );
            }
            sourceURIs.push(...singleSourceList);
        }
        return [...new Set(sourceURIs)];
    }
}

/**
 * Copy a file if it's changed.
 *
 * @param src Source file to copy.
 * @param dest Destination to copy it to.
 * @param workspaceProvider Workspace provider.
 * @throws If the copy fails.
 */
async function copyIfChanged(
    src: URI,
    dest: URI,
    workspaceProvider: WorkspaceProvider,
) {
    let srcStat, destStat;

    try {
        destStat = await workspaceProvider.fs.stat(dest);
    } catch {
        // Continue on to copy
    }
    if (destStat !== undefined) {
        try {
            srcStat = await workspaceProvider.fs.stat(src);
            // If the files have the same sizes, they may be the same
            if (srcStat.size === destStat.size) {
                // Assume they're the same if timestamps match
                if (srcStat.mtime === destStat.mtime) {
                    return;
                }
                // We could read in and compare, but let's take the
                // simpler approach and just copy
            }
        } catch {
            // If we run into a problem w/the source URI, shrug and give up
            return;
        }
    }

    await workspaceProvider.fs.copy(src, dest, { overwrite: true });
}

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
    workspaceProvider: WorkspaceProvider,
) {
    const uri = UriUtils.joinPath(rootUri, dir);
    try {
        await workspaceProvider.fs.readDirectory(uri);
        dirsExist[dir] = true;
    } catch (e) {
        if (e instanceof vscode.FileSystemError && e.code === "FileNotFound") {
            dirsExist[dir] = false;
        } else {
            throw e;
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
    storyName?: string,
): BuildDirAndStoryUris {
    const buildDir = currentConfig.build.outputPath;
    let storyFilename = currentConfig.build.outputFilename;
    if (!storyFilename) {
        storyFilename = (storyName ?? "story").replace(/ /g, "-");
        if (!storyFilename.endsWith(".")) {
            storyFilename += ".";
        }
        storyFilename += "html";
    }
    const buildDirUri = UriUtils.joinPath(
        workspaceProvider.rootWorkspaceUri() ?? URI.file("."),
        buildDir,
    );
    const storyUri = UriUtils.joinPath(buildDirUri, storyFilename);
    return { build: buildDirUri, story: storyUri };
}

/**
 * See if we need to create project directories.
 *
 * @param workspaceProvider Workspace provider.
 */
export async function buildProjectDirectoriesIfNeeded(
    workspaceProvider: WorkspaceProvider,
) {
    // If the user doesn't want to create project directories, don't offer
    if (
        !workspaceProvider.getConfigurationItem(
            Configuration.BaseSection,
            Configuration.ProjectCreate,
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

    // Remove any glob sections from storySources, along w/anything that
    // looks like a file at the end
    const storySourceDirs = new Set(
        currentConfig.build.storySourceFiles.map((sourceDir) =>
            sourceDir
                .replace(/(?<=^|\/)\*\*\/.*$/, "")
                .replace(/(?<=^|\/)[^/]*?\.[^/]+?$/, ""),
        ),
    );
    const projectDirs = [
        ...currentConfig.build.storyFormatPaths,
        ...storySourceDirs,
        ...currentConfig.build.includeSourcePaths,
        currentConfig.build.outputPath,
    ].map((d) => removeEndingSlash(d));

    const directoriesExist: Record<string, boolean> = {};
    for (const d of projectDirs) {
        await recordDirectoryExistence(
            d,
            rootUri,
            directoriesExist,
            workspaceProvider,
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
        "Don't Ask Again",
    );

    // Return unless the choice is "Yes"
    if (selection !== "Yes") {
        if (selection === "Don't Ask Again") {
            // "Don't ask again" -> update the workspace-local configuration
            vscode.workspace
                .getConfiguration(Configuration.BaseSection)
                .update(
                    Configuration.ProjectCreate,
                    false,
                    vscode.ConfigurationTarget.Workspace,
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
export async function downloadLocalStoryFormatIfNeeded(
    storyFormat: StoryFormat,
    allowRedownloading: boolean,
    workspaceProvider: WorkspaceProvider,
) {
    // If the user doesn't want to download story formats, don't offer
    if (
        !workspaceProvider.getConfigurationItem(
            Configuration.BaseSection,
            Configuration.DownloadStoryFormat,
        )
    ) {
        return;
    }

    const alreadyDownloaded =
        (await findLocalStoryFormat(storyFormat, workspaceProvider)) !==
        undefined;

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
                    `Downloading story format ${storyFormat.format} isn't currently supported`,
                );
            }
            return;

        case StoryFormatDownloadSupport.MissingVersion:
            // Give a warning and return
            vscode.window.showInformationMessage(
                "The story format in the :: StoryData passage has no format-version, limiting the available support",
            );
            return;
    }

    const selection = await vscode.window.showInformationMessage(
        `Download a local copy of ${storyFormat.format} version ${storyFormat.formatVersion ?? "unknown"}?`,
        "Download",
        "Cancel",
        "Don't Ask Again",
    );

    // Return unless the choice is "Download"
    if (selection !== "Download") {
        if (selection === "Don't Ask Again") {
            // "Don't ask again" -> update the workspace-local configuration
            const config = vscode.workspace.getConfiguration(
                Configuration.BaseSection,
            );
            config.update(
                Configuration.DownloadStoryFormat,
                false,
                vscode.ConfigurationTarget.Workspace,
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
        () => downloadStoryFormat(storyFormat),
    );
    if (format instanceof Error) {
        vscode.window.showErrorMessage(
            `Could not download ${storyFormat.format} version ${storyFormat.formatVersion ?? "unknown"}: ${format.message}`,
        );
    } else {
        try {
            const outUri = vscode.Uri.joinPath(
                workspaceProvider.rootWorkspaceUri() ?? URI.file("."),
                workspacePathToWriteStoryFormatTo(storyFormat) ?? "format.js",
            );
            await workspaceProvider.fs.writeFile(outUri, Buffer.from(format));
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "unknown error";
            vscode.window.showErrorMessage(
                `Could not write the downloaded ${storyFormat.format} file: ${message}`,
            );
        }
    }
}

/**
 * Read a story format from a local copy, or ask the user to download if it doesn't exist.
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
    workspaceProvider: WorkspaceProvider,
): Promise<string | undefined> {
    try {
        return await readLocalStoryFormat(storyFormat, workspaceProvider);
    } catch (err) {
        // If it's any error other than "file not found", throw
        if (err instanceof Error && !err.message.includes("ENOENT")) {
            throw err;
        }

        await vscode.window.showErrorMessage(
            `Couldn't find a local copy of the story format ${storyFormat.format}`,
        );
        // Don't await this call so we don't wait around for the user to make up their mind
        downloadLocalStoryFormatIfNeeded(storyFormat, true, workspaceProvider);
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
    workspaceProvider: WorkspaceProvider,
) {
    const rootUri = workspaceProvider.rootWorkspaceUri();
    if (rootUri === undefined) {
        // No workspace has been opened
        return;
    }

    let currentFileUri: URI | undefined; // Current file URI
    try {
        let storyFormatData: string | undefined;

        // See if we have a cached format
        if (cachedStoryFormat?.contents !== undefined) {
            storyFormatData = cachedStoryFormat.contents;
        }

        signalContextEvent("buildStarts");
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            true,
        );

        // Get all files from the source directories
        const allFiles = (
            await getFilesFromSources(
                currentConfig.build.storySourceFiles,
                currentConfig.build.ignores,
                workspaceProvider,
            )
        )
            .filter((f) => canAddFileToStory(UriUtils.basename(f)))
            .sort(); // Sort to match Tweego order
        if (allFiles.length === 0) {
            vscode.window.showInformationMessage(`Found no files to build`);
            return;
        }

        // Parse all of the files into a Twine story
        const story: Story = { passages: [] };
        for (const fileUri of allFiles) {
            currentFileUri = fileUri;
            const contents = Buffer.from(
                await workspaceProvider.fs.readFile(currentFileUri),
            );
            addFileToStory(story, UriUtils.basename(currentFileUri), contents);
        }

        validateStory(story);

        // Get the story format if it hasn't already been gotten or if the newly-parsed
        // story has a different story format than what's cached. (That should never happen,
        // but weirder things have occurred.)
        if (
            cachedStoryFormat === undefined ||
            story.storyData?.storyFormat?.format !==
                cachedStoryFormat.format.format ||
            story.storyData?.storyFormat?.formatVersion !==
                cachedStoryFormat.format.formatVersion
        ) {
            const maybeStoryFormatData =
                await readLocalStoryFormatOrAskToDownload(
                    story.storyData?.storyFormat ?? { format: "unknown" },
                    workspaceProvider,
                );
            if (maybeStoryFormatData === undefined) {
                // If it's not read, then return
                return;
            }
            storyFormatData = maybeStoryFormatData;
        }

        // Compile to an HTML string
        const html = compileStory(story, storyFormatData ?? "unknown", options);

        // Write out the final game
        const outUris = getBuildAndStoryUris(workspaceProvider, story.name);
        await workspaceProvider.fs.writeFile(outUris.story, Buffer.from(html));

        // If there are any include files, copy those over as needed
        const includeErrors = [];
        for (let includeSourcePath of currentConfig.build.includeSourcePaths ??
            []) {
            includeSourcePath = removeEndingSlash(includeSourcePath);
            const includeSourceWorkspaceUri = UriUtils.joinPath(
                workspaceProvider.rootWorkspaceUri() ?? URI.file("."),
                removeEndingSlash(includeSourcePath),
            );
            try {
                const includeSourceWorkspacePath =
                    includeSourceWorkspaceUri.toString(true);
                const includeSourceStat = await workspaceProvider.fs.stat(
                    includeSourceWorkspaceUri,
                );
                // Get all matching files, finding files recursively for directories
                const includeFilesWorkspaceUris = await getFilesFromSources(
                    [
                        includeSourceStat.type === FileType.Directory
                            ? includeSourcePath + "/**/*"
                            : includeSourcePath,
                    ],
                    currentConfig.build.ignores,
                    workspaceProvider,
                );
                let results: PromiseSettledResult<void>[];
                if (includeSourceStat.type === FileType.Directory) {
                    // To replicate the structure of an included directory, we
                    // can't just copy the file to the build directory. Instead,
                    // we need to copy the file to the build directory *plus the
                    // sub-directories beneath the includeSourcePath*.
                    results = await Promise.allSettled(
                        includeFilesWorkspaceUris.map((fileWorkspaceUri) => {
                            let fileRelativePath: string;
                            const fileWorkspacePath =
                                fileWorkspaceUri.toString(true);
                            // First: is the raw include src path in the found file's path?
                            const ndx = fileWorkspacePath.indexOf(
                                includeSourceWorkspacePath,
                            );
                            if (ndx !== -1) {
                                fileRelativePath = fileWorkspacePath.slice(
                                    ndx + includeSourceWorkspacePath.length,
                                );
                            } else {
                                // Fallback: Remove everything before the name of the
                                // raw include directory, which can give odd results if
                                // that directory's name shows up multiple times in
                                // the URI (ex: `file://root/include/fonts/include/font.otf`)
                                fileRelativePath = fileWorkspacePath
                                    .split(includeSourcePath, 1)
                                    .slice(-1)[0];
                            }
                            return copyIfChanged(
                                fileWorkspaceUri,
                                UriUtils.joinPath(
                                    outUris.build,
                                    fileRelativePath,
                                ),
                                workspaceProvider,
                            );
                        }),
                    );
                } else {
                    results = await Promise.allSettled(
                        includeFilesWorkspaceUris.map((fileUri) =>
                            copyIfChanged(
                                fileUri,
                                UriUtils.joinPath(
                                    outUris.build,
                                    UriUtils.basename(fileUri),
                                ),
                                workspaceProvider,
                            ),
                        ),
                    );
                }
                for (const result of results) {
                    if (result.status === "rejected") {
                        includeErrors.push(result.reason);
                    }
                }
            } catch (err) {
                if (err instanceof Error) includeErrors.push(err.message);
            }
        }

        if (includeErrors.length !== 0) {
            vscode.window.showErrorMessage(
                `Build failed: Problems copying included files\n${includeErrors.join("\n")}`,
            );
        } else {
            // Tell everyone our build was successful
            signalContextEvent("buildSuccessful", outUris.story);
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : "unknown error";
        vscode.window.showErrorMessage(`Build failed: ${message}`);
        // If we have a Twee parsing error, try to show the document and annotate the error
        if (err instanceof TweeParseError && currentFileUri) {
            const doc = await vscode.workspace.openTextDocument(currentFileUri);
            const editor = await vscode.window.showTextDocument(doc);
            const { line } = doc.positionAt(err.start);
            const range = doc.validateRange(
                new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
            );
            editor.revealRange(
                range,
                vscode.TextEditorRevealType.InCenterIfOutsideViewport,
            );
            editor.selection = new vscode.Selection(line, 0, line, 0);
            addTrailingAnnotation(editor, line, `Error: ${err.message.trim()}`);
        }
    } finally {
        signalContextEvent("buildEnds");
        await vscode.commands.executeCommand(
            "setContext",
            CustomWhenContext.Building,
            false,
        );
    }
}
