// For interfaces and constants that need to be the same on client and server side

import { RequestType, RequestType0, URI } from "vscode-languageserver-protocol";

/**
 * The project's files (per role) that the server indexes.
 *
 * @typeParam U How a file is identified. Defaults to a URI string.
 */
export interface ProjectFiles<U = URI> {
    /** `.tw` and `.twee` */
    tweeFiles: U[];
    /** `.js` files concatenated into the Story JavaScript */
    storyScriptFiles: U[];
    /** `.js` files that are copied beside the built story */
    includedScripts: U[];
}

/**
 * Request from the server that the client find project files.
 */
export const FindProjectFilesRequest: RequestType0<ProjectFiles, unknown> =
    new RequestType0("twee3/findProjectFiles");

/**
 * Request from the server that the client find files by a glob.
 */
export const FindFilesRequest: RequestType<string, URI[], unknown> =
    new RequestType("twee3/findFiles");

/**
 * Request from the server that the client read a file.
 */
export const ReadFileRequest: RequestType<
    { uri: URI; encoding?: string },
    string,
    unknown
> = new RequestType("fs/readFile");
