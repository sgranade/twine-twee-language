import { ambientSound, noAmbientSound } from "./ambient-sound";
import { backLink } from "./back-link";
import { cyclingLink } from "./cycling-link";
import { dropdownMenu } from "./dropdown-menu";
import { embedFlickrImage } from "./embed-flickr-image";
import { embedImage } from "./embed-image";
import { embedPassage } from "./embed-passage";
import { embedUnsplashImage } from "./embed-unsplash-image";
import { embedYouTubeVideo } from "./embed-youtube-video";
import { link } from "./link";
import { restartLink } from "./restart-link";
import { revealLink } from "./reveal-link";
import { soundEffect } from "./sound-effect";
import { textInput } from "./text-input";
import { InsertInfo } from "./types";

export * from "./types";

const builtins: InsertInfo[] = [
    ambientSound,
    backLink,
    cyclingLink,
    dropdownMenu,
    embedFlickrImage,
    embedImage,
    embedPassage,
    embedUnsplashImage,
    embedYouTubeVideo,
    link,
    noAmbientSound,
    restartLink,
    revealLink,
    soundEffect,
    textInput,
];

const inserts = [...builtins];

/**
 * Get all insert parsers.
 * @returns Insert parsers.
 */
export function all(): readonly InsertInfo[] {
    return inserts;
}
