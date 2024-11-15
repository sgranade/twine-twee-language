/**
 * Interface for providing VS Code like workspace functions.
 */

import { URI } from "vscode-uri";

export interface WorkspaceProvider {
    /**
     * Find files across all workspace folders in the workspace.
     *
     * @example
     * findFiles('**​/*.js', '**​/node_modules/**', 10)
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
        exclude?: string,
        maxResults?: number
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
    getConfigurationItem(section: string, item: string): any;
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
         * Create a new directory (Note, that new files are created via `write`-calls).
         *
         * *Note* that missing directories are created automatically, e.g this call has
         * `mkdirp` semantics.
         *
         * @param uri The uri of the new folder.
         */
        createDirectory(uri: URI): Thenable<void>;
        /**
         * Retrieve all entries of a {@link FileType.Directory directory}.
         *
         * @param uri The uri of the folder.
         * @returns An array of name/type-tuples or a thenable that resolves to such.
         * @throws Error (FileNotFound) if the directory isn't found.
         */
        readDirectory(uri: URI): Thenable<[string, FileType][]>;
        /**
         * Read the entire contents of a file.
         *
         * @param uri The uri of the file.
         * @returns An array of bytes or a thenable that resolves to such.
         */
        readFile: (uri: URI) => Thenable<Uint8Array>;
        /**
         * Write data to a file, replacing its entire contents.
         *
         * @param uri The uri of the file.
         * @param content The new content of the file.
         */
        writeFile: (uri: URI, content: Uint8Array) => Thenable<void>;
    };
}

/**
 * Enumerations taken from vscode.
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
