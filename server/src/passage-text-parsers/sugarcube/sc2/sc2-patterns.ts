/**
 * Adapted from SugarCube's `patterns.js` and twee3-language-tools `macros.ts`.
 *
 * Any changes to this file need to be reflected also in the two `client-server.ts` files.
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
 * Verbatim HTML, JS scripts or CSS style blocks.
 * This is also mainly important to keep us from interpolating variables or parsing macros.
 */
export const htmlScriptStyleBlock = [
    ["(?!<<)<html>(?!>)", "(?!<<)</html>(?!>)"],
    ["(?!<<)<script[^>]*>(?!>)", "(?!<<)</script>(?!>)"],
    ["(?!<<)<style[^>]*>(?!>)", "(?!<<)</style>(?!>)"],
]
    .map(([open, close]) => `(?:${open}(?:.|\r?\n)*?${close})`)
    .join("|");
/**
 * Acceptable character in a custom HTML element's name.
 */
const cENChar =
    "(?:[\\x2D.0-9A-Z_a-z\\xB7\\xC0-\\xD6\\xD8-\\xF6\\xF8-\\u037D\\u037F-\\u1FFF\\u200C\\u200D\\u203F\\u2040\\u2070-\\u218F\\u2C00-\\u2FEF\\u3001-\\uD7FF\\uF900-\\uFDCF\\uFDF0-\\uFFFD]|[\\uD800-\\uDB7F][\\uDC00-\\uDFFF])";
/**
 * HTML tag.
 *
 * Element Name:
 *   [A-Za-z] [0-9A-Za-z]*
 *
 * Custom Element Name:
 *   [a-z] (CENChar)* '-' (CENChar)*
 * CENChar:
 *   "-" | "." | [0-9] | "_" | [a-z] | #xB7 | [#xC0-#xD6] | [#xD8-#xF6] | [#xF8-#x37D] | [#x37F-#x1FFF] | [#x200C-#x200D] | [#x203F-#x2040] | [#x2070-#x218F] | [#x2C00-#x2FEF] | [#x3001-#xD7FF] | [#xF900-#xFDCF] | [#xFDF0-#xFFFD] | [#x10000-#xEFFFF]
 */
const htmlTagName = `[A-Za-z](?:${cENChar}*-${cENChar}*|[0-9A-Za-z]*)`;
/**
 * HTML tag attribute's name.
 */
export const htmlAttrName = `[^\\u0000-\\u001F\\u007F-\\u009F\\s"'>\\/=]+`;
/**
 * HTML tag attribute's value.
 */
export const htmlAttrValue = `(?:"[^"]*?"|'[^']*?'|[^\\s"'=<>\`]+)`;
/**
 * HTML tag.
 */
export const htmlTag = `<${htmlTagName}(?:\\s+${htmlAttrName}(?:\\s*=\\s*${htmlAttrValue})?)*\\s*\\/?>`;
/**
 * Script macro block.
 */
export const scriptMacroBlock = [
    ["<<script(?:\\s*(?<language>.*?)\\s*)>>", "<</script>>"],
]
    .map(
        ([open, close]) =>
            `(?:(?<open>${open})(?<contents>(?:.|\r?\n)*?)${close})`
    )
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
