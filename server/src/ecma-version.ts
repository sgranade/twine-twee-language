import type * as acorn from "acorn";

/**
 * The ECMA version we're going to parse with.
 */
export const ParseEcmaVersion: acorn.ecmaVersion = "latest";
/**
 * The ECMA version we're going to analyze scope with.
 *
 * eslint-scope requires numeric versions, so can't work with
 * "latest" the way acorn can. We'll have to keep updating this
 * as acorn gets new syntax that can affect scoping.
 */
export const ScopeEcmaVersion = 2026;
