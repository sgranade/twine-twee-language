export const builtInVarsAndProperties: ReadonlySet<string> = new Set([
    "Config.addVisitedLinkClass",
    "Config.cleanupWikifierOutput",
    "Config.debug",
    "Config.enableOptionalDebugging",
    "Config.loadDelay",
    "Config.audio.pauseOnFadeToZero",
    "Config.audio.preloadMetadata",
    "Config.history.controls",
    "Config.history.maxStates",
    "Config.macros.maxLoopIterations",
    "Config.macros.typeSkipKey",
    "Config.macros.typeVisitedPassages",
    "Config.navigation.override",
    "Config.passages.displayTitles",
    "Config.passages.nobr",
    "Config.passages.onProcess",
    "Config.passages.start",
    "Config.passages.transitionOut",
    "Config.saves.descriptions",
    "Config.saves.id",
    "Config.saves.isAllowed",
    "Config.saves.maxAutoSaves",
    "Config.saves.maxSlotSaves",
    "Config.saves.version",
    "Config.ui.stowBarInitially",
    "Config.ui.updateStoryElements",
    "Dialog",
    "Engine.lastPlay",
    "Engine.state",
    "Fullscreen.element",
    "LoadScreen",
    "Macro.tags",
    "Save.Type",
    "Save.browser",
    "Save.browser.size",
    "Save.browser.auto",
    "Save.browser.auto.size",
    "Save.browser.slot",
    "Save.browser.slot.size",
    "Save.disk",
    "Save.base64",
    "Save.onLoad",
    "Save.onLoad.size",
    "Save.onSave",
    "Save.onSave.size",
    "Setting",
    "settings",
    "SimpleAudio.tracks",
    "SimpleAudio.groups",
    "SimpleAudio.lists",
    "State.active",
    "State.bottom",
    "State.current",
    "State.length",
    "State.passage",
    "State.size",
    "State.temporary",
    "State.top",
    "State.turns",
    "State.variables",
    "State.metadata",
    "State.metadata.size",
    "State.prng",
    "State.prng.pull",
    "State.prng.seed",
    "Story.id",
    "Story.ifId",
    "Story.name",
    "Template.size",
    "UI",
    "UIBar",
    "$", // JQuery
    "jQuery",
    "l10nStrings",
    "setup",
]);

export const builtinVars: ReadonlySet<string> = new Set(
    [...builtInVarsAndProperties].map((x) => x.split(".", 1)[0]),
);

// Last-segment property names that exist on SugarCube objects, keyed by the
// root of the property chain that can reach them. Keying by root keeps
// author-chosen names like `$player.name` from being exempted. `this` is only
// listed for its MacroContext members; Passage members (`id`, `name`, `tags`,
// `text`) are reachable only from untraceable roots (call results), so they're omitted.
export const builtinSugarCubePropertiesByRoot: ReadonlyMap<
    string,
    ReadonlySet<string>
> = new Map([
    [
        "this",
        new Set([
            "args",
            "full",
            "raw",
            "name",
            "output",
            "parent",
            "parser",
            "payload",
            "self",
        ]),
    ],
]);

/**
 * Is a property a built-in SugarCube property reachable from its root?
 *
 * @param property Full dotted path, e.g. `this.args.full`.
 * @returns True if the property's last segment is a built-in member of its root.
 */
export function isBuiltinSugarCubeProperty(property: string): boolean {
    const segments = property.split(".");
    return !!builtinSugarCubePropertiesByRoot
        .get(segments[0])
        ?.has(segments[segments.length - 1]);
}
