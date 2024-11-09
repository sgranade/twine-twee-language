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
    fs: {
        /**
         * Read the entire contents of a file.
         *
         * @param uri The uri of the file.
         * @returns An array of bytes or a thenable that resolves to such.
         */
        readFile: (uri: URI) => Thenable<Uint8Array>;
    };
}
