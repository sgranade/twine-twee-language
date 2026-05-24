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

// Properties that exist on existing SugarCube objects, like Passage.
// In diagnostics, we're going to ignore these properties (which, yes,
// hacky, but probably the best we can do with this static analysis).
export const builtinSugarCubeProperties: ReadonlySet<string> = new Set([
    "args", // MacroContext
    "args.full", // MacroContext
    "args.raw", // MacroContext
    "name", // MacroContext
    "output", // MacroContext
    "parent", // MacroContext
    "parser", // MacroContext
    "payload", // MacroContext
    "self", // MacroContext
    "id", // Passage
    "name", // Passage
    "tags", // Passage
    "text", // Passage
]);
