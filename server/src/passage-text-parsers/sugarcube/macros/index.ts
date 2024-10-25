import {
    audioMacro,
    cacheaudioMacro,
    createaudiogroupMacro,
    createplaylistMacro,
    masteraudioMacro,
    playlistMacro,
    removeaudiogroupMacro,
    removeplaylistMacro,
    trackMacro,
    waitforaudioMacro,
} from "./audio";
import {
    breakMacro,
    caseMacro,
    continueMacro,
    defaultMacro,
    elseMacro,
    forMacro,
    ifMacro,
    switchMacro,
} from "./control";
import {
    getAllCustomMacros,
    removeDocument as removeCustomMacroDocument,
    setCustomMacros,
} from "./custom";
import {
    doMacro,
    equalsMacro,
    includeMacro,
    minusMacro,
    nobrMacro,
    printMacro,
    redoMacro,
    silentlyMacro,
    silentMacro,
    typeMacro,
} from "./display";
import {
    addclassMacro,
    appendMacro,
    copyMacro,
    prependMacro,
    removeclassMacro,
    removeMacro,
    replaceMacro,
    toggleclassMacro,
} from "./dom";
import {
    buttonMacro,
    checkboxMacro,
    cycleMacro,
    linkappendMacro,
    linkMacro,
    linkprependMacro,
    linkreplaceMacro,
    listboxMacro,
    numberboxMacro,
    optionMacro,
    optionsfromMacro,
    radiobuttonMacro,
    textareaMacro,
    textboxMacro,
} from "./interactive";
import { actionsMacro, backMacro, choiceMacro, returnMacro } from "./links";
import {
    doneMacro,
    gotoMacro,
    nextMacro,
    repeatdelayMacro,
    stopMacro,
    timedMacro,
    widgetMacro,
} from "./miscellaneous";
import { runMacro, scriptMacro } from "./scripting";
import { MacroInfo } from "./types";
import { captureMacro, setMacro, unsetMacro } from "./variables";

export * from "./types";

const builtins: MacroInfo[] = [
    captureMacro,
    setMacro,
    unsetMacro,
    runMacro,
    scriptMacro,
    equalsMacro,
    minusMacro,
    doMacro,
    includeMacro,
    nobrMacro,
    printMacro,
    redoMacro,
    silentMacro,
    silentlyMacro,
    typeMacro,
    ifMacro,
    elseMacro,
    forMacro,
    breakMacro,
    continueMacro,
    switchMacro,
    caseMacro,
    defaultMacro,
    buttonMacro,
    checkboxMacro,
    cycleMacro,
    optionMacro,
    optionsfromMacro,
    linkMacro,
    linkappendMacro,
    linkprependMacro,
    linkreplaceMacro,
    listboxMacro,
    numberboxMacro,
    radiobuttonMacro,
    textareaMacro,
    textboxMacro,
    backMacro,
    returnMacro,
    actionsMacro,
    choiceMacro,
    addclassMacro,
    appendMacro,
    copyMacro,
    prependMacro,
    removeMacro,
    removeclassMacro,
    replaceMacro,
    toggleclassMacro,
    audioMacro,
    cacheaudioMacro,
    createaudiogroupMacro,
    trackMacro,
    createplaylistMacro,
    masteraudioMacro,
    playlistMacro,
    removeaudiogroupMacro,
    removeplaylistMacro,
    waitforaudioMacro,
    doneMacro,
    gotoMacro,
    repeatdelayMacro,
    stopMacro,
    timedMacro,
    nextMacro,
    widgetMacro,
];

const macros = Object.fromEntries(builtins.map((el) => [el.name, el]));

// Make custom macro cache functions available via this index file
export { removeCustomMacroDocument, setCustomMacros };

/**
 * Get all SugarCube macros.
 * @returns Macros.
 */
export function all(): Record<string, MacroInfo> {
    return { ...macros, ...getAllCustomMacros() };
}
