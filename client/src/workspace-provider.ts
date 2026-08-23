/**
 * Interface for providing VS Code like workspace functions.
 */

import { URI } from "vscode-uri";

export interface WorkspaceProvider {
    /**
     * Find files across all workspace folders in the workspace.
     *
     * @param include A glob pattern that defines the files to search for. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace.
     * @param exclude  A glob pattern that defines files and folders to exclude. The glob pattern
     * will be matched against the file paths of resulting matches relative to their workspace.
     * When `undefined`, default file-excludes (e.g. the `files.exclude`-setting
     * but not `search.exclude`) will apply. When `null`, no excludes will apply.
     * @param maxResults An upper-bound for the result.
     * @returns A thenable that resolves to an array of resource identifiers. Will return no results if no
     * workspace folders are opened.
     */
    findFiles(
        include: string,
        exclude?: string | null,
        maxResults?: number,
    ): Thenable<URI[]>;
    /**
     * Get a workspace configuration item.
     *
     * Dots in the identifiers are interpreted as child-access,
     * like `{ myExt: { setting: { doIt: true }}}` and `getConfiguration('myExt.setting').get('doIt') === true`.
     *
     * @param section Dot-separated configuration section identifier.
     * @param item Dot-separated configuration item identifier.
     * @returns The configuration item.
     */
    getConfigurationItem<T>(section: string, item: string): T;
    /**
     * URI of the first entry in the workspace folders.
     *
     * Returns undefined if no workspace is open.
     *
     * N.B. we don't currently support multiple workspace folders.
     */
    rootWorkspaceUri(): URI | undefined;
    fs: {
        /**
         * Retrieve metadata about a file.
         *
         * @param uri The uri of the file to retrieve metadata about.
         * @returns The file metadata about the file.
         */
        stat(uri: URI): Thenable<FileStat>;
        /**
         * Retrieve all entries of a {@link FileType.Directory directory}.
         *
         * @param uri The uri of the folder.
         * @returns An array of name/type-tuples or a thenable that resolves to such.
         * @throws Error (FileNotFound) if the directory isn't found.
         */
        readDirectory(uri: URI): Thenable<[string, FileType][]>;
        /**
         * Create a new directory (Note, that new files are created via `write`-calls).
         *
         * *Note* that missing directories are created automatically, e.g this call has
         * `mkdirp` semantics.
         *
         * @param uri The uri of the new folder.
         */
        createDirectory(uri: URI): Thenable<void>;
        /**
         * Read the entire contents of a file.
         *
         * @param uri The uri of the file.
         * @returns An array of bytes or a thenable that resolves to such.
         * @throws Error (FileNotFound) if the directory isn't found.
         */
        readFile: (uri: URI) => Thenable<Uint8Array>;
        /**
         * Write data to a file, replacing its entire contents.
         *
         * @param uri The uri of the file.
         * @param content The new content of the file.
         */
        writeFile: (uri: URI, content: Uint8Array) => Thenable<void>;
        /**
         * Copy files or folders.
         *
         * @param source The existing file.
         * @param target The destination location.
         * @param options Defines if existing files should be overwritten.
         */
        copy(
            source: URI,
            target: URI,
            options?: {
                /**
                 * Overwrite the file if it does exist.
                 */
                overwrite?: boolean;
            },
        ): Thenable<void>;
    };
}

/**
 * Enumerations and interfaces taken from vscode.
 */

/**
 * Enumeration of file types. The types `File` and `Directory` can also be
 * a symbolic links, in that case use `FileType.File | FileType.SymbolicLink` and
 * `FileType.Directory | FileType.SymbolicLink`.
 */
export enum FileType {
    /**
     * The file type is unknown.
     */
    Unknown = 0,
    /**
     * A regular file.
     */
    File = 1,
    /**
     * A directory.
     */
    Directory = 2,
    /**
     * A symbolic link to a file.
     */
    SymbolicLink = 64,
}

enum FilePermission {
    /**
     * The file is readonly.
     *
     * *Note:* All `FileStat` from a `FileSystemProvider` that is registered with
     * the option `isReadonly: true` will be implicitly handled as if `FilePermission.Readonly`
     * is set. As a consequence, it is not possible to have a readonly file system provider
     * registered where some `FileStat` are not readonly.
     */
    Readonly = 1,
}

interface FileStat {
    /**
     * The type of the file, e.g. is a regular file, a directory, or symbolic link
     * to a file.
     *
     * *Note:* This value might be a bitmask, e.g. `FileType.File | FileType.SymbolicLink`.
     */
    type: FileType;
    /**
     * The creation timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     */
    ctime: number;
    /**
     * The modification timestamp in milliseconds elapsed since January 1, 1970 00:00:00 UTC.
     *
     * *Note:* If the file changed, it is important to provide an updated `mtime` that advanced
     * from the previous value. Otherwise there may be optimizations in place that will not show
     * the updated file contents in an editor for example.
     */
    mtime: number;
    /**
     * The size in bytes.
     *
     * *Note:* If the file changed, it is important to provide an updated `size`. Otherwise there
     * may be optimizations in place that will not show the updated file contents in an editor for
     * example.
     */
    size: number;
    /**
     * The permissions of the file, e.g. whether the file is readonly.
     *
     * *Note:* This value might be a bitmask, e.g. `FilePermission.Readonly | FilePermission.Other`.
     */
    permissions?: FilePermission;
}
