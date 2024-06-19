// For interfaces and constants that need to be the same on client and server side

import { RequestType, RequestType0, URI } from "vscode-languageserver";

export enum CustomMessages {
    RequestReindex = "twee3/requestReindex",
    UpdatedStoryFormat = "twee3/storyformat",
}

export interface StoryFormat {
    format: string;
    formatVersion?: string;
}

/**
 * Request from the server that the client find Twee files.
 */
export const FindTweeFilesRequest: RequestType0<URI[], any> = new RequestType0(
    "twee3/findTweeFiles"
);

/**
 * Request from the server that the client read a file.
 */
export const ReadFileRequest: RequestType<
    { uri: URI; encoding?: string },
    string,
    any
> = new RequestType("fs/readFile");
