import { chapbookProperties } from "./chapbook-properties";
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
 * Roots of Chapbook's built-in variables that are plain lookup objects on `window`.
 * A story variable with the same name is shadowed by them.
 */
export const chapbookLookupRoots: ReadonlySet<string> = new Set(
    chapbookProperties
        .map((x) => x.split(".", 1)[0])
        .filter((x) => !stateBackedRoots.has(x)),
);

const shadowedRootRegex = /^[\w$]+/;

/**
 * Determine whether a variable name is shadowed in JavaScript contexts.
 *
 * @param name Raw name of the variable being set; may be dotted.
 * @returns The shadowed root name and what shadows it, or undefined if the name isn't shadowed.
 */
export function findShadowedVariable(
    name: string,
): { root: string; shadowedBy: "browser" | "chapbook" } | undefined {
    const root = shadowedRootRegex.exec(name)?.[0];
    if (root === undefined) return undefined;
    if (chapbookLookupRoots.has(root)) return { root, shadowedBy: "chapbook" };
    if (windowGlobals.has(root)) return { root, shadowedBy: "browser" };
    return undefined;
}

/**
 * Create the diagnostic message for a shadowed variable.
 *
 * @param root Name of the shadowed variable.
 * @param shadowedBy What shadows the variable.
 */
export function shadowedVariableMessage(
    root: string,
    shadowedBy: "browser" | "chapbook",
): string {
    const what =
        shadowedBy === "browser" ? "browser global" : "Chapbook built-in";
    return `\`${root}\` is already a ${what}, so Chapbook can't make this variable available to JavaScript. \`[if]\` conditions, \`[JavaScript]\` and vars-section values will see the ${what === "browser global" ? "browser's" : "built-in"} \`${root}\` instead; only \`{${root}}\` inserts see your variable. Rename it to fix this.`;
}
