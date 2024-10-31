/**
 * Adapted from SugarCube's `patterns.js` and twee3-language-tools `macros.ts`.
 *
 * Any changes to this file need to be relfected also in the two `client-server.ts` files.
 */

/**
 * TwineScript variables with a single `$` (with no `$` before it) or `_` sigil.
 * Separate from the `variable` pattern b/c we don't accept `$$var` but do accept `_$var`.
 */
export const variableWithSigil = "(?:(?<!\\$)\\$[A-Za-z_]|_[A-Za-z$_])[\\w$]*";
/**
 * TwineScript variable identifier.
 */
export const identifier = "[A-Za-z$_][\\w$]*";
/**
 * Blocks that act as a comment block.
 */
export const commentBlock = [
    ["/\\*", "\\*/"],
    ["/%", "%/"],
    ["<!--", "-->"],
]
    .map(([open, close]) => `(?:${open}(?:.|\r?\n)*?${close})`)
    .join("|");
/**
 * Blocks in which no wiki markup will be done.
 * This is mainly important to keep us from interpolating variables or parsing macros.
 */
export const noWikiBlock = [
    ["\\{\\{\\{", "\\}\\}\\}"],
    ['"""', '"""'],
    ["<nowiki>", "</nowiki>"],
]
    .map(([open, close]) => `(?:${open}(?:.|\r?\n)*?${close})`)
    .join("|");
/**
 * JS scripts or CSS style blocks.
 * This is also mainly important to keep us from interpolating variables or parsing macros.
 */
export const scriptStyleBlock = [
    ["(?!<<)<script>(?!>)", "(?!<<)</script>(?!>)"],
    ["(?!<<)<style>(?!>)", "(?!<<)</style>(?!>)"],
]
    .map(([open, close]) => `(?:${open}(?:.|\r?\n)*?${close})`)
    .join("|");
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
 * A macro name.
 */
const macroNamePattern = `[A-Za-z][\\w-]*|[=-]`;
/**
 * Pattern for a full macro. Taken from twee3-language-tools, `macros.ts`
 */
export const fullMacro = `<<${macroEnd}?(?<macroName>${macroNamePattern})(?<preMacroBodySpace>\\s*)${macroBody}${macroSelfClose}?>>`;
