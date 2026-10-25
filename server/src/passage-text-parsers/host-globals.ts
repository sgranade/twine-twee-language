/**
 * Globals supplied by the browser (and libraries Twine ships), as opposed to
 * JavaScript-the-language (which are in `js-parser.ts`). Each story format
 * decides which of these to keep out of the story index via
 * `StoryFormatParsingState.hostGlobals` so formats like Chapbook can allow
 * ones in that
 */

/**
 * Browser globals an author's probably not going to pick as a story variable name.
 */
export const browserGlobals: ReadonlySet<string> = new Set([
    "console",
    "document",
    "window",
    "setTimeout",
    "setInterval",
    "clearTimeout",
    "clearInterval",
    "requestAnimationFrame",
    "cancelAnimationFrame",
    "queueMicrotask",
    "structuredClone",
    "fetch",
    "localStorage",
    "sessionStorage",
    "Audio",
    "Image",
    "URL",
    "URLSearchParams",
    "CustomEvent",
    "WebAssembly",
]);

/**
 * Browser globals whose names an author could plausibly use for a story
 * variable (a `location` in the story, a `history` of choices).
 */
export const collisionProneBrowserGlobals: ReadonlySet<string> = new Set([
    "location",
    "history",
    "navigator",
    "alert",
    "prompt",
    "confirm",
]);

/**
 * jQuery's globals. A bare `$` is safe to treat as jQuery only in formats
 * whose story-variable sigil is desugared away before JavaScript parsing
 * (by which I mean SugarCube).
 */
export const jQueryGlobals: ReadonlySet<string> = new Set(["$", "jQuery"]);
