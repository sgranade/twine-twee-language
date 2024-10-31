// For interfaces and constants that need to be the same on client and server side

import { RequestType, RequestType0, URI } from "vscode-languageclient";

/**
 * Messages
 */

export enum CustomMessages {
    RequestReindex = "twee3/requestReindex",
    UpdatedStoryFormat = "twee3/storyformat",
    UpdatedSugarCubeMacroList = "twee3/sugarcube/macrolist",
}

/**
 * Story format information sent as part of the UpdatedStoryFormat message.
 */
export interface StoryFormat {
    format: string;
    formatVersion?: string;
}

/**
 * SugarCube 2 macro info sent as part of the UpdatedSugarCubeMacroList message.
 */
export interface SC2MacroInfo {
    name: string;
    isContainer: boolean;
    isChild: boolean;
}

/**
 * Requests
 */

/**
 * Request from the server that the client find Twee files.
 *
 * This isn't just a file glob (as per below) so clients can offer users more
 * control over what counts as a Twee 3 file.
 */
export const FindTweeFilesRequest: RequestType0<URI[], any> = new RequestType0(
    "twee3/findTweeFiles"
);

/**
 * Request from the server that the client find files by a glob.
 */
export const FindFilesRequest: RequestType<string, URI[], any> =
    new RequestType("twee3/findFiles");

/**
 * Request from the server that the client read a file.
 */
export const ReadFileRequest: RequestType<
    { uri: URI; encoding?: string },
    string,
    any
> = new RequestType("fs/readFile");

/**
 * Helper functions
 */

// All of the following is adapted from SugarCube 2 `parserlib.js` and twee3-language-tools `macros.ts`
// and is needed because the VS Code client needs to make onEnter rules specifically for macros.

/**
 * Body of a macro (i.e. its arguments). Taken from SugarCube 2 `parserlib.js`
 */
const macroBody = [
    `(?<macroBody>(?:`,
    `(?:/\\*[^*]*\\*+(?:[^/*][^*]*\\*+)*/)|`,
    `(?://.*\\n)|`,
    `(?:\`(?:\\\\.|[^\`\\\\])*?\`)|`,
    `(?:"(?:\\\\.|[^"\\\\\\n])*?")|`,
    `(?:'(?:\\\\.|[^'\\\\\\n])*?')|`,
    `(?:\\[(?:[<>]?[Ii][Mm][Gg])?\\[[^\\r\\n]*?\\]\\]+)|[^>]|`,
    `(?:>(?!>))`,
    `)*?)`,
].join("");
/**
 * Self-close portion of a macro (e.g. <<testy/>>)
 */
const macroSelfClose = `(?<macroSelfClose>/)`;
/**
 * Prefix that indicates a closing macro (e.g. <</testy>> or <<endtesty>>).
 */
const macroEnd = `(?<macroEnd>/|end)`;
/**
 * Create a regex pattern to find an opening SugarCube 2 container macro, like `<<silently>>`.
 * @param name Container macro's name.
 * @returns String containing the regex pattern.
 */
export function createSC2OpenContainerMacroPattern(name: string) {
    return `<<(${name})(?:\\s+${macroBody})?>>`;
}
/**
 * Create a regex pattern to find a closing SugarCube 2 container macro, like `<</silently>>`.
 * @param name Container macro's name.
 * @returns String containing the regex pattern.
 */
export function createSC2CloseContainerMacroPattern(name: string) {
    return `(?:<<(${name})(?:\\s*)${macroBody}${macroSelfClose}>>)|(?:<<${macroEnd}(${name})>>)`;
}
