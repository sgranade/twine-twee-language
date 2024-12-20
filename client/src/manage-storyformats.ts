// eslint-disable-next-line @typescript-eslint/no-require-imports
import AdmZip = require("adm-zip");
import { URI, Utils } from "vscode-uri";

import { StoryFormat } from "./client-server";
import { Configuration } from "./constants";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * In-memory cache of the story's format.
 */
export interface CachedStoryFormat {
    /**
     * Information about the story format.
     */
    format: StoryFormat;
    /**
     * Contents of the format's `format.js` file, if available.
     */
    contents?: string;
}

let cachedStoryFormat: CachedStoryFormat | undefined;

/**
 * Cache a story format.
 *
 * If the story format is available locally, its contents will be
 * cached as well. Await the function if you need that to be completed
 * before continuing.
 *
 * @param format Story format to cache.
 * @param workspaceProvider Workspace provider.
 */
export async function cacheStoryFormat(
    format: StoryFormat,
    workspaceProvider: WorkspaceProvider
) {
    cachedStoryFormat = { format };
    try {
        cachedStoryFormat.contents = await readLocalStoryFormat(
            format,
            workspaceProvider
        );
    } catch {
        // If we fail, we don't care
    }
}

export function getCachedStoryFormat(): CachedStoryFormat | undefined {
    return cachedStoryFormat;
}

/**
 * Get the language ID that corresponds to a given story format.
 *
 * @param storyFormat The story format whose ID we need.
 * @param languages VS Code installed languages from `vscode.languages.getLanguages()`.
 * @returns The story format ID.
 */
export function storyFormatToLanguageID(
    storyFormat: StoryFormat,
    languages: string[]
): string {
    let languageId = "twee3"; // The generic twee3 language ID

    // If there's no story format, then all we can do is choose the generic twee3 language
    if (storyFormat?.format !== undefined) {
        // Get a language format, starting with the most specific and going from there.
        // Currently we only support languages based on the major version number
        // (i.e. `twee3-chapbook-2` and not `twee3-chapbook-2-1`)
        let format = `twee3-${storyFormat.format}`.toLowerCase();
        if (storyFormat.formatVersion !== undefined) {
            const testLanguage = `${format}-${storyFormat.formatVersion.split(".")[0]}`;
            if (languages.includes(testLanguage)) {
                format = testLanguage;
            }
        } else if (!languages.includes(format)) {
            // As a fallback, pick the most recent version of the story format
            let provisionalFormat: undefined | string;
            for (const lang of languages) {
                if (lang.startsWith(format)) {
                    if (
                        provisionalFormat === undefined ||
                        lang[lang.length - 1] >
                            provisionalFormat[provisionalFormat.length - 1]
                    ) {
                        provisionalFormat = lang;
                    }
                }
            }
            if (provisionalFormat !== undefined) {
                format = provisionalFormat;
            }
        }

        if (languages.includes(format)) {
            languageId = format;
        }
    }

    return languageId;
}

/**
 * Turn story format information into a Tweego ID.
 *
 * If the story format doesn't include a version number, no Tweego ID is created.
 *
 * @param storyFormat Story format.
 * @returns Tweego ID for the story format, or undefined if it can't be created.
 */
export function storyFormatToTweegoID(
    storyFormat: StoryFormat
): string | undefined {
    if (storyFormat.formatVersion === undefined) {
        return undefined;
    }
    return `${storyFormat.format}-${storyFormat.formatVersion.replace(/\./g, "-")}`.toLowerCase();
}

/**
 * Get the (relative) path to the story format file in the workspace.
 *
 * @param storyFormat Story format.
 * @param workspaceProvider Workspace function provider.
 * @returns Workspace path to the story format's local files, or undefined if it can't be created.
 */
export function storyFormatToWorkspacePath(
    storyFormat: StoryFormat,
    workspaceProvider: WorkspaceProvider
): string {
    const tweegoId = storyFormatToTweegoID(storyFormat);
    if (tweegoId === undefined) {
        return undefined;
    }
    const storyFormatDirectory =
        workspaceProvider.getConfigurationItem<string>(
            Configuration.BaseSection,
            Configuration.StoryFormatsDirectory
        ) ?? ".";
    const path = Utils.joinPath(
        URI.file(storyFormatDirectory),
        tweegoId,
        "format.js"
    ).path;
    if (path.startsWith("/") && !storyFormatDirectory.startsWith("/")) {
        return path.slice(1);
    }
    return path;
}

export enum StoryFormatDownloadSupport {
    /**
     * The extension supports downloading this format.
     */
    OK,
    /**
     * The story format isn't supported (such as Harlowe).
     */
    StoryFormatNotSupported,
    /**
     * There's no format-version number.
     */
    MissingVersion,
    /**
     * The format-version number isn't digits separated by periods (e.g. `1.2.3`)
     */
    BadVersionFormat,
}

/**
 * See if a story format can be downloaded.
 *
 * @param storyFormat Story format to check.
 * @returns Enum indicating whether or not we support downloading the story format.
 */
export function storyFormatSupportsDownloading(
    storyFormat: StoryFormat
): StoryFormatDownloadSupport {
    if (storyFormat.formatVersion === undefined) {
        return StoryFormatDownloadSupport.MissingVersion;
    }
    if (!/^\d+(\.\d+)*$/.test(storyFormat.formatVersion)) {
        return StoryFormatDownloadSupport.BadVersionFormat;
    }
    const name = storyFormat.format.toLowerCase();
    if (name !== "chapbook" && name !== "sugarcube") {
        return StoryFormatDownloadSupport.StoryFormatNotSupported;
    }
    return StoryFormatDownloadSupport.OK;
}

/**
 * Read a local Twine story format.
 *
 * @param storyFormat Story format to read.
 * @returns The story format's contents.
 * @throws Error if the story format couldn't be read.
 */
export async function readLocalStoryFormat(
    storyFormat: StoryFormat,
    workspaceProvider: WorkspaceProvider
): Promise<string> {
    const currentStoryFormat = {
        format: storyFormat.format,
        formatVersion: storyFormat.formatVersion,
    };
    while (currentStoryFormat.formatVersion) {
        const path = storyFormatToWorkspacePath(
            currentStoryFormat,
            workspaceProvider
        );
        if (path === undefined) {
            throw new Error(
                `Couldn't create a local path for story format ${currentStoryFormat.format} version ${currentStoryFormat.formatVersion}`
            );
        }
        const storyFormatUri = (
            await workspaceProvider.findFiles(path, undefined, 1)
        )[0];
        // If we didn't find a file, try reducing the precision of the story format version
        // (so "2.1.3" becomes "2.1", while "2.1" would become "2")
        if (storyFormatUri === undefined) {
            const formatParts = currentStoryFormat.formatVersion.split(".");
            if (formatParts.length < 2) {
                break;
            }
            currentStoryFormat.formatVersion = formatParts
                .slice(0, -1)
                .join(".");
        } else {
            return Buffer.from(
                await workspaceProvider.fs.readFile(storyFormatUri)
            ).toString("utf-8");
        }
    }
    throw new Error(
        `Couldn't find a local copy of story format ${currentStoryFormat.format} version ${currentStoryFormat.formatVersion}`
    );
}

/**
 * See if the project contains a local copy of the story format.
 *
 * @param storyFormat Story format to check.
 * @param workspaceProvider Workspace provider.
 * @returns True if the story format exists locally.
 */
export async function localStoryFormatExists(
    storyFormat: StoryFormat,
    workspaceProvider: WorkspaceProvider
): Promise<boolean> {
    const path = storyFormatToWorkspacePath(storyFormat, workspaceProvider);
    if (path === undefined) {
        return false;
    }
    const files = await workspaceProvider.findFiles(path, undefined, 1);
    return files.length > 0;
}

export const ChapbookMainPage = "https://klembot.github.io/chapbook/";
export const ChapbookArchiveUri = URI.parse(
    "https://github.com/klembot/chapbook/blob/develop/previous-versions/"
); // This is a URI since we have to do path math with it

/**
 * Download a Chapbook story format version.
 *
 * @param version Chapbook version to download.
 * @returns The format, or an error if it failed.
 */
async function downloadChapbookFormat(
    version: string
): Promise<string | Error> {
    // Chapbook formats are in two locations. The most recent is listed on the
    // main Chapbook page, while the previous versions are archived on Github.
    // We try first to see if the requested version is in the archive, then
    // see if it's listed on the main page.
    const url = Utils.joinPath(
        ChapbookArchiveUri,
        version,
        "format.js"
    ).toString();
    try {
        const responseFormat = await fetch(url);
        if (responseFormat.ok) {
            return responseFormat.text();
        }
        // Fall through to try the latest version
    } catch (err) {
        return new Error(err.message);
    }

    try {
        const responseMainPage = await fetch(ChapbookMainPage);
        if (responseMainPage.ok) {
            const text = await responseMainPage.text();
            const m = text.match(/https:\/\/.*?\/([\d.]+)\/format.js/);
            if (m?.[1] === version) {
                const responseFormat = await fetch(m[0]);
                if (responseFormat.ok) {
                    return responseFormat.text();
                } else {
                    return new Error(`Couldn't download Chapbook ${version}`);
                }
            } else if (m === null) {
                return new Error(
                    "Couldn't find the link to the latest Chapbook version to download"
                );
            }
        }
    } catch (err) {
        return new Error(err.message);
    }

    return new Error(`Couldn't find Chapbook ${version} to download`);
}

/**
 * Download a SugarCube story format version.
 *
 * @param version SugarCube version to download.
 * @returns The format, or an error if it failed.
 */
async function downloadSugarCubeFormat(
    version: string
): Promise<string | Error> {
    // We try to get the SugarCube format from Github
    const url = `https://github.com/tmedwards/sugarcube-2/releases/download/v${version}/sugarcube-${version}-for-twine-2.1-local.zip`;
    try {
        const responseZipFile = await fetch(url);
        if (responseZipFile.ok) {
            const zip = new AdmZip(
                Buffer.from(await responseZipFile.arrayBuffer())
            );
            const formatEntry = zip
                .getEntries()
                .find((e) => e.entryName.endsWith("format.js"));
            if (formatEntry !== undefined) {
                return zip.readAsText(formatEntry);
            } else {
                return new Error(
                    `Couldn't find the format.js file in the downloaded SugarCube ${version} zip archive`
                );
            }
        }
    } catch (err) {
        return new Error(err.message);
    }

    return new Error(`Couldn't find SugarCube ${version} to download`);
}

/**
 * Download a Twine story format.
 *
 * It currently only supports Chapbook and SugarCube.
 *
 * @param storyFormat Story format to download.
 * @returns The story format, or Error if it fails.
 */
export async function downloadStoryFormat(
    storyFormat: StoryFormat
): Promise<string | Error> {
    if (storyFormat.formatVersion === undefined) {
        return new Error("Story format downloads require a format version");
    }

    const formatName = storyFormat.format.toLowerCase();
    if (formatName === "chapbook") {
        return await downloadChapbookFormat(storyFormat.formatVersion);
    } else if (formatName === "sugarcube") {
        return await downloadSugarCubeFormat(storyFormat.formatVersion);
    }

    return new Error(
        `Downloading story format ${storyFormat.format} isn't currently supported`
    );
}
