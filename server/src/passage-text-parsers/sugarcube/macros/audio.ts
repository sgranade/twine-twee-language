import { MacroInfo } from "./types";

export const audioMacro: MacroInfo = {
    name: "audio",
    arguments: true,
    syntax: "<<audio trackIdList actionList>>",
    description:
        "Controls the playback of audio tracks, which must be set up via `<<cacheaudio>>`.",
    since: "2.0.0",
};

export const cacheaudioMacro: MacroInfo = {
    name: "cacheaudio",
    arguments: ["text &+ text &+ ...text"],
    syntax: "<<cacheaudio trackIdList sourceList>>",
    description: "Caches an audio track for use by the other audio macros.",
    since: "2.0.0",
};

export const createaudiogroupMacro: MacroInfo = {
    name: "createaudiogroup",
    container: true,
    arguments: ["text"],
    syntax: "<<createaudiogroup groupId>>\n\t[<<track trackId>> …]\n<</createaudiogroup>>",
    description:
        "Collects tracks, which must be set up via `<<cacheaudio>>`, into a group via its `<<track>>` children. Groups are useful for applying actions to multiple tracks simultaneously and/or excluding the included tracks from a larger set when applying actions.",
    since: "2.19.0",
};

export const trackMacro: MacroInfo = {
    name: "track",
    arguments: true,
    parents: ["createaudiogroup", "createplaylist"],
    syntax: "<<track trackId>>",
    description: "Add a track to an audio group or playlist.",
    since: "2.8.0",
};

export const createplaylistMacro: MacroInfo = {
    name: "createplaylist",
    container: true,
    arguments: ["text"],
    syntax: "<<createplaylist listId>>\n\t[<<track trackId>> …]\n<</createplaylist>>",
    description:
        "Collects tracks, which must be set up via `<<cacheaudio>>`, into a playlist via its `<<track>>` children.",
    since: "2.8.0",
};

export const masteraudioMacro: MacroInfo = {
    name: "masteraudio",
    arguments: true,
    syntax: "<<masteraudio actionList>>",
    description: "Controls the master audio settings.",
    since: "2.8.0",
};

export const playlistMacro: MacroInfo = {
    name: "playlist",
    arguments: true,
    syntax: "<<playlist listId actionList>>",
    description:
        "Controls the playback of the playlist, which must be set up via `<<createplaylist>>`.",
    since: "2.0.0",
};

export const removeaudiogroupMacro: MacroInfo = {
    name: "removeaudiogroup",
    arguments: ["text"],
    syntax: "<<removeaudiogroup groupId>>",
    description: "Removes the audio group with the given ID.",
    since: "2.28.0",
};

export const removeplaylistMacro: MacroInfo = {
    name: "removeplaylist",
    arguments: ["text"],
    syntax: "<<removeplaylist listId>>",
    description: "Removes the playlist with the given ID.",
    since: "2.8.0",
};

export const waitforaudioMacro: MacroInfo = {
    name: "waitforaudio",
    arguments: false,
    syntax: "<<waitforaudio>>",
    description:
        "Displays the loading screen until all currently registered audio has either loaded to a playable state or aborted loading due to errors. Requires tracks to be set up via `<<cacheaudio>>`.",
    since: "2.8.0",
};
