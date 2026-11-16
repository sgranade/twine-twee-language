import { URI, Utils as UriUtils } from "vscode-uri";

import { isScriptFile, isTweeFile } from "@tt3/shared";
import { FileType, WorkspaceProvider } from "./workspace-provider";

/**
 * The parts of the project config that set a story's files.
 */
export interface FileSetConfig {
    build: {
        storySourceFiles: string[];
        includeSourcePaths?: string[];
        ignores?: string[];
    };
}

/**
 * A story's files by role.
 */
export interface FileSets {
    /** `.tw` and `.twee` files */
    tweeFiles: URI[];
    /** `.js` files  */
    storyScriptFiles: URI[];
    /** `.js` files under `includeSourcePaths` */
    includedScripts: URI[];
}

/**
 * Remove the ending slash from a string, if it exists.
 *
 * @param str String to remove slash from.
 * @returns String without any ending slash.
 */
function removeEndingSlash(str: string): string {
    return str.endsWith("/") ? str.slice(0, -1) : str;
}

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
 * A resolved entry in `includeSourcePaths`.
 */
interface IncludeEntry {
    /** The entry w/o any trailing slash */
    entry: string;
    isDirectory: boolean;
    sourceUri: URI;
    /** Every file the entry yields */
    files: URI[];
}

/**
 * Resolve one `includeSourcePaths` entry.
 * @param entry Entry from `includeSourcePaths`.
 * @param ignores Glob patterns to ignore.
 * @param workspaceProvider Workspace provider.
 * @returns The resolved entry.
 * @throws If the entry can't be stat'd.
 */
export async function resolveIncludeEntry(
    entry: string,
    ignores: string[] | undefined,
    workspaceProvider: WorkspaceProvider,
): Promise<IncludeEntry> {
    entry = removeEndingSlash(entry);
    const sourceUri = UriUtils.joinPath(
        workspaceProvider.rootWorkspaceUri() ?? URI.file("."),
        entry,
    );
    const isDirectory =
        (await workspaceProvider.fs.stat(sourceUri)).type ===
        FileType.Directory;
    const files = await getFilesFromSources(
        [isDirectory ? entry + "/**/*" : entry],
        ignores,
        workspaceProvider,
    );
    return { entry, isDirectory, sourceUri, files };
}

/**
 * An included file copied during build.
 */
export interface IncludeCopy {
    source: URI;
    destination: URI;
}

/**
 * Work out where the build copies an include entry's files.
 * @param include Resolved include entry.
 * @param buildUri URI to the build directory.
 */
export function includeCopies(
    include: IncludeEntry,
    buildUri: URI,
): IncludeCopy[] {
    if (!include.isDirectory) {
        return include.files.map((source) => ({
            source,
            destination: UriUtils.joinPath(buildUri, UriUtils.basename(source)),
        }));
    }

    const includeSourceWorkspacePath = include.sourceUri.toString(true);
    return include.files.map((source) => {
        let fileRelativePath: string;
        const fileWorkspacePath = source.toString(true);
        // First: is the raw include src path in the found file's path?
        const ndx = fileWorkspacePath.indexOf(includeSourceWorkspacePath);
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
                .split(include.entry, 1)
                .slice(-1)[0];
        }
        return {
            source,
            destination: UriUtils.joinPath(buildUri, fileRelativePath),
        };
    });
}

/**
 * Resolve the project's Twee files, story script files, and included scripts.
 * @param config Project config.
 * @param workspaceProvider Workspace provider.
 */
export async function resolveFileSets(
    config: FileSetConfig,
    workspaceProvider: WorkspaceProvider,
): Promise<FileSets> {
    const storySourceFiles = await getFilesFromSources(
        config.build.storySourceFiles,
        config.build.ignores,
        workspaceProvider,
    );
    const tweeFiles = storySourceFiles.filter((f) => isTweeFile(f.path));
    const storyScriptFiles = storySourceFiles.filter((f) =>
        isScriptFile(f.path),
    );
    const storyScriptKeys = new Set(storyScriptFiles.map((f) => f.toString()));

    const included = new Map<string, URI>();
    for (const entry of config.build.includeSourcePaths ?? []) {
        let include: IncludeEntry;
        try {
            include = await resolveIncludeEntry(
                entry,
                config.build.ignores,
                workspaceProvider,
            );
        } catch {
            continue; // Skip missing entries
        }
        for (const f of include.files) {
            const key = f.toString();
            if (isScriptFile(f.path) && !storyScriptKeys.has(key)) {
                included.set(key, f);
            }
        }
    }

    return {
        tweeFiles,
        storyScriptFiles,
        includedScripts: [...included.values()],
    };
}
