/**
 * Adapted from SugarCube's `patterns.js`
 */

export namespace sc2Patterns {
    /**
     * TwineScript variables with a single `$` (with no `$` before it) or `_` sigil.
     * Separate from the `variable` pattern b/c we don't accept `$$var` but do accept `_$var`.
     */
    export const variableWithSigil =
        "(?:(?<!\\$)\\$[A-Za-z_]|_[A-Za-z$_])[\\w$]*";
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
     * This is mainly important to keep us from interpolating variables.
     */
    export const noWikiBlock = [
        ["\\{\\{\\{", "\\}\\}\\}"],
        ['"""', '"""'],
        ["<nowiki>", "</nowiki>"],
    ]
        .map(([open, close]) => `(?:${open}(?:.|\r?\n)*?${close})`)
        .join("|");
}
