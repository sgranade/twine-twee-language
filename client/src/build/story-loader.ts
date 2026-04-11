import { Passage, Story } from "./types";
import { parseTwee3 } from "./twee-parser";

/**
 * Get the media type from a filename's extension.
 *
 * @param ext Filename extension
 * @returns Media type, or undefined if not known.
 */
function mediaTypeFromExt(ext: string): string | undefined {
    let mediaType: string;

    // AUDIO NOTES:
    //
    // The preferred media type for WAVE audio is `audio/wave`; however,
    // some browsers only recognize `audio/wav`, requiring its use instead.
    if (ext === "aac" || ext === "flac" || ext === "ogg" || ext === "wav") {
        mediaType = "audio/" + ext;
    } else if (ext === "mp3") {
        mediaType = "audio/mpeg";
    } else if (ext === "m4a") {
        mediaType = "audio/mp4";
    } else if (ext === "oga" || ext === "opus") {
        mediaType = "audio/ogg";
    } else if (ext === "wave") {
        mediaType = "audio/wav";
    } else if (ext === "weba") {
        mediaType = "audio/webm";
    }

    // FONT NOTES:
    //
    // (ca. 2017) The IANA deprecated the various font subtypes of the
    // "application" type in favor of the new "font" type.  While the
    // standards were new at that point, many browsers had long accepted
    // such media types due to existing use in the wild—erroneous at
    // that point or not.
    //     otf   : application/font-sfnt  → font/otf
    //     ttf   : application/font-sfnt  → font/ttf
    //     woff  : application/font-woff  → font/woff
    //     woff2 : application/font-woff2 → font/woff2
    else if (
        ext === "otf" ||
        ext === "ttf" ||
        ext === "woff" ||
        ext === "woff2"
    ) {
        mediaType = "font/" + ext;
    }

    // IMAGE NOTES:
    else if (
        ext === "gif" ||
        ext === "jpeg" ||
        ext === "png" ||
        ext === "tiff" ||
        ext === "webp"
    ) {
        mediaType = "image/" + ext;
    } else if (ext === "jpg") {
        mediaType = "image/jpeg";
    } else if (ext === "svg") {
        mediaType = "image/svg+xml";
    } else if (ext === "tif") {
        mediaType = "image/tiff";
    }

    // METADATA NOTES:
    //
    // Name aside, WebVTT files are generic media cue metadata files
    // that may be used with either `<audio>` or `<video>` elements.
    else if (ext === "vtt") {
        // WebVTT (Web Video Text Tracks)
        mediaType = "text/vtt";
    }

    // VIDEO NOTES:
    else if (ext === "mp4" || ext === "webm") {
        mediaType = "video/" + ext;
    } else if (ext === "ogv") {
        mediaType = "video/ogg";
    }

    return mediaType;
}

/**
 * Create a SugarCube 2 media passage.
 *
 * For more information and a list of media passage tags, see
 * https://www.motoslave.net/sugarcube/2/docs/#guide-media-passages
 *
 * @param fileStem Stem portion of the media's filename. ex: for `image.gif` it's `image`
 * @param ext Extension of the media's filename.
 * @param contents Contents of the media file.
 * @param passageTag Media passage tag.
 * @returns The passage containing the encoded media.
 */
function createSugarCube2MediaPassage(
    fileStem: string,
    ext: string,
    contents: Buffer,
    passageTag: string
): Passage {
    const dataString = `data:${mediaTypeFromExt(ext)};base64,${contents.toString("base64")}`;

    return {
        name: fileStem,
        isScript: false,
        isStylesheet: true,
        text: dataString,
        tags: [passageTag],
    };
}

interface FilenameParts {
    /**
     * The stem. For `story.twee`, the stem is `story`. For `archive.tar.gz` it's `archive`.
     */
    stem: string;
    /**
     * The extension, if it exists. For `archive.tar.gz` it's `gz`.
     */
    ext?: string;
}

/**
 * Divide a base filename into constituent parts.
 *
 * @param basename Base filename (like `story.twee`).
 * @returns The individual parts of the filename.
 */
function filenameParts(basename: string): FilenameParts {
    const filepartsList = basename.split(".");
    const filenameParts: FilenameParts = {
        stem: filepartsList[0],
    };
    if (filepartsList.length >= 2) {
        filenameParts.ext = filepartsList.pop();
    }
    return filenameParts;
}

/**
 * Extensions that can be added to a Story.
 */
const supportedExtensions = new RegExp(
    "^" +
        [
            "tw(ee)?",
            "css",
            "js",
            "(o|t)tf",
            "woff2?",
            "gif",
            "jpe?g",
            "png",
            "svg",
            "tiff?",
            "webp",
            "aac",
            "flac",
            "m4a",
            "mp(3|4)",
            "og(a|g|v)",
            "opus",
            "wave?",
            "web(a|m)",
            "vtt",
        ].join("|") +
        "$"
);

/**
 * See if a file can be loaded into a Story.
 *
 * @param basename Base filename, such as `story.twee`.
 * @returns True if the file can be added to a Story.
 */
export function canAddFileToStory(basename: string): boolean {
    const { ext } = filenameParts(basename);
    return supportedExtensions.test(ext?.toLowerCase() || "");
}

/**
 * Add a file to a Twine story.
 *
 * @param story Story to add the file to.
 * @param basename File basename, such as `story.twee`.
 * @param contents Contents of the file.
 * @param encoding Text encoding of the file, if known.
 */
export function addFileToStory(
    story: Story,
    basename: string,
    contents: Buffer,
    encoding?: BufferEncoding
) {
    // eslint-disable-next-line prefer-const
    let { stem, ext } = filenameParts(basename);
    if (ext === undefined) {
        return; // No extension
    }
    ext = ext.toLowerCase();

    if (ext === "tw" || ext === "twee") {
        parseTwee3(story, contents.toString(encoding));
    } else if (ext === "css" || ext === "js") {
        story.passages.push({
            name: basename,
            isScript: ext === "js",
            isStylesheet: ext === "css",
            text: contents.toString(encoding),
            tags: [ext === "css" ? "stylesheet" : "script"],
        });
    } else if (
        ext === "otf" ||
        ext === "ttf" ||
        ext === "woff" ||
        ext === "woff2"
    ) {
        // Turn a font into a base64-encoded CSS font face
        const family = stem;
        let hint = ext;
        if (hint === "ttf") {
            hint = "truetype";
        } else if (hint === "otf") {
            hint = "opentype";
        }
        const css = `@font-face {\n\tfont-family: "${family}";\n\tsrc: url("data:${mediaTypeFromExt(ext)};base64,${contents.toString("base64")}") format("${hint}");\n}`;
        story.passages.push({
            name: basename,
            isScript: false,
            isStylesheet: true,
            text: css,
            tags: ["stylesheet"],
        });
    } else if (
        ext === "gif" ||
        ext === "jpeg" ||
        ext === "jpg" ||
        ext === "png" ||
        ext === "svg" ||
        ext === "tif" ||
        ext === "tiff" ||
        ext === "webp"
    ) {
        story.passages.push(
            createSugarCube2MediaPassage(stem, ext, contents, "Twine.image")
        );
    } else if (
        ext === "aac" ||
        ext === "flac" ||
        ext === "m4a" ||
        ext === "mp3" ||
        ext === "oga" ||
        ext === "ogg" ||
        ext === "opus" ||
        ext === "wav" ||
        ext == "wave" ||
        ext == "weba"
    ) {
        story.passages.push(
            createSugarCube2MediaPassage(stem, ext, contents, "Twine.audio")
        );
    } else if (ext === "mp4" || ext === "ogv" || ext === "webm") {
        story.passages.push(
            createSugarCube2MediaPassage(stem, ext, contents, "Twine.video")
        );
    } else if (ext === "vtt") {
        story.passages.push(
            createSugarCube2MediaPassage(stem, ext, contents, "Twine.vtt")
        );
    }
}

/**
 * Validate a story has everything it needs after loading.
 *
 * @param story Story to be validated.
 * @throws Error if the story doesn't validate properly.
 */
export function validateStory(story: Story) {
    if (story.name === undefined) {
        story.name = "";
    }
    if (story.storyData === undefined) {
        throw new Error("Story has no story data");
    }
    if (story.storyData.start === undefined) {
        story.storyData.start = "Start";
    }
    if (
        !/^[a-fA-F\d]{8}-[a-fA-F\d]{4}-4[a-fA-F\d]{3}-[a-fA-F\d]{4}-[a-fA-F\d]{12}$/.test(
            story.storyData.ifid
        )
    ) {
        throw new Error(
            `Story has a badly-formatted IFID value: ${story.storyData.ifid}`
        );
    }
    // Final check: see if the start passage exists
    for (const p of story.passages) {
        if (p.name === story.storyData.start) {
            return;
        }
    }
    throw new Error(`Starting passage ${story.storyData.start} not found`);
}
