import { chapbookPropertyRoots } from "./chapbook-properties";
import { windowGlobals } from "./window-globals";

/**
 * Roots of Chapbook's built-in variables that are set via `set`/`setDefault(s)`.
 * Chapbook proxies these through its state, so they don't shadow anything.
 */
const stateBackedRoots: ReadonlySet<string> = new Set([
    "config",
    "sound",
    "trail",
]);

/**
 * Roots of Chapbook's story-format built-ins that are plain lookup objects on
 * `window`. A story variable with the same name is shadowed by them.
 */
export const chapbookLookupRoots: ReadonlySet<string> = new Set(
    [...chapbookPropertyRoots].filter((x) => !stateBackedRoots.has(x)),
);

/**
 * Source that's shadowing a story variable: a host global (or one of
 * JavaScript's own globals) on `window`, or a Chapbook story-format built-in.
 */
export type ShadowSource = "browser" | "chapbook";

/**
 * A story variable that's shadowed in JavaScript contexts.
 */
export interface ShadowedVariable {
    /** Shadowed name: the first segment of the variable's name. */
    root: string;
    shadowedBy: ShadowSource;
}

/**
 * Author-facing wording for each shadow source.
 */
const shadowSourceLabels: Readonly<
    Record<ShadowSource, { noun: string; possessive: string }>
> = {
    browser: { noun: "browser global", possessive: "browser's" },
    chapbook: { noun: "Chapbook built-in", possessive: "built-in" },
};
const shadowedRootRegex = /^[\w$]+/;

/**
 * Determine whether a story variable name is shadowed in JavaScript contexts.
 *
 * @param name Raw name of the variable being set; may be dotted.
 * @returns The shadowed root name and what shadows it, or undefined if the name isn't shadowed.
 */
export function findShadowedVariable(
    name: string,
): ShadowedVariable | undefined {
    const root = shadowedRootRegex.exec(name)?.[0];
    if (root === undefined) return undefined;
    if (chapbookLookupRoots.has(root)) return { root, shadowedBy: "chapbook" };
    if (windowGlobals.has(root)) return { root, shadowedBy: "browser" };
    return undefined;
}

/**
 * Create the diagnostic message for a shadowed story variable.
 *
 * @param shadowed The shadowed variable.
 */
export function shadowedVariableMessage(shadowed: ShadowedVariable): string {
    const { root } = shadowed;
    const { noun, possessive } = shadowSourceLabels[shadowed.shadowedBy];
    return `\`${root}\` is already a ${noun}, so Chapbook can't make this variable available to JavaScript. \`[if]\` conditions, \`[JavaScript]\` and vars-section values will see the ${possessive} \`${root}\` instead; only \`{${root}}\` inserts see your variable. Rename it to fix this.`;
}
