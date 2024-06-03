// For interfaces and constants that need to be the same on client and server side

import { RequestType, URI } from "vscode-languageserver";

export enum CustomMessages {
    UpdatedStoryFormat = "twee3/storyformat",
}

export interface StoryFormat {
    format: string;
    formatVersion?: string;
}

/**
 * Request from the server that the client find files.
 */
export const FindFilesRequest: RequestType<
    { pattern: string; rootPath?: URI },
    URI[],
    any
> = new RequestType("fs/findFiles");

/**
 * Request from the server that the client read a file.
 */
export const ReadFileRequest: RequestType<
    { uri: URI; encoding?: string },
    string,
    any
> = new RequestType("fs/readFile");
