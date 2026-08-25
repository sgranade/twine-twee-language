/**
 * SugarCube 2 macro info sent as part of the UpdatedSugarCubeMacroList message.
 */
export interface SC2MacroInfo {
    name: string;
    isContainer: boolean;
    isChild: boolean;
}

// All of the following is adapted from SugarCube 2 `parserlib.js` and twee3-language-tools `macros.ts`
// and is needed because the VS Code client needs to make onEnter rules specifically for macros.

/**
 * Body of a macro (i.e. its arguments). Taken from SugarCube 2 `parserlib.js`
 */
export const sc2MacroBody = [
    `((?:`,
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
export const sc2MacroSelfClose = `(/)`;
/**
 * Prefix that indicates a closing macro (e.g. <</testy>> or <<endtesty>>).
 */
export const sc2MacroEnd = `(/|end)`;
/**
 * Create a regex pattern to find an opening SugarCube 2 container macro, like `<<silently>>`.
 * @param name Container macro's name.
 * @returns String containing the regex pattern.
 */
export function createSC2OpenContainerMacroPattern(name: string) {
    return `<<(${name})(?:\\s+${sc2MacroBody})?>>`;
}
/**
 * Create a regex pattern to find a closing SugarCube 2 container macro, like `<</silently>>`.
 * @param name Container macro's name.
 * @returns String containing the regex pattern.
 */
export function createSC2CloseContainerMacroPattern(name: string) {
    return `(?:<<(${name})(?:\\s*)${sc2MacroBody}${sc2MacroSelfClose}>>)|(?:<<${sc2MacroEnd}(${name})>>)`;
}
