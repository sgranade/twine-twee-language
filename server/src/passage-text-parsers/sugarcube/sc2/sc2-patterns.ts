/**
 * Adapted from SugarCube's `patterns.js` and twee3-language-tools `macros.ts`.
 *
 * Some portions of this are defined in `client-server.ts` because the client needs them
 * to do some client-side parsing.
 */

import {
    sc2MacroBody,
    sc2MacroEnd,
    sc2MacroSelfClose,
} from "../../../client-server";

/**
 * \s character class without a line terminator.
 */
const spaceNoTerminator =
    "[\\u0020\\f\\t\\v\\u00a0\\u1680\\u180e\\u2000-\\u200a\\u202f\\u205f\\u3000\\ufeff]";
/**
 * Any letter, which also includes `-` (sure, why not).
 */
const anyLetter =
    "[0-9A-Z_a-z\\-\\u00c0-\\u00d6\\u00d8-\\u00f6\\u00f8-\\u00ff\\u0150\\u0170\\u0151\\u0171]";
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
 * CSS ID or class sigil.
 */
const cssIdOrClassSigil = "[#.]";
/**
 * CSS style pattern.
 */
const cssStyle = `(${spaceNoTerminator}*)(${anyLetter}+)(${spaceNoTerminator}*:${spaceNoTerminator}*)([^;\\|\\n]+);`;
/**
 * CSS ID or class.
 */
export const singleCssIdOrClass = `${cssIdOrClassSigil}${anyLetter}+${spaceNoTerminator}*`;
/**
 * Conjoined CSS IDs or classes.
 */
const conjoinedCssIdsOrClasses = `(${spaceNoTerminator}*)((?:${cssIdOrClassSigil}${anyLetter}+${spaceNoTerminator}*)+);`;
/**
 * Inline CSS pattern.
 *
 * Groups:
 *   1, 2, 3, 4: [space] style [space:space] value;
 *   5, 6:       [space] #id.classname.otherClass; <- can have spaces in between IDs and classnames
 */
export const inlineCss = `${cssStyle}|${conjoinedCssIdsOrClasses}`;
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

// Most of the macro regexes are in `client-server.ts` because the client
// needs access to them

/**
 * A macro name.
 */
const sc2MacroNamePattern = `[A-Za-z][\\w-]*|[=-]`;
/**
 * Pattern for a full macro. Taken from twee3-language-tools, `macros.ts`
 */
export const fullMacro = `<<${sc2MacroEnd}?(?<macroName>${sc2MacroNamePattern})(?<preMacroBodySpace>\\s*)${sc2MacroBody}${sc2MacroSelfClose}?>>`;
