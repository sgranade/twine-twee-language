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
    const fileparts = basename.split(".");
    if (fileparts.length < 2) {
        return; // No extension
    }
    const ext = fileparts.pop().toLowerCase();

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
        const family = fileparts[0];
        let hint = ext;
        if (hint === "ttf") {
            hint = "truetype";
        } else if (hint === "otf") {
            hint = "opentype";
        }
        const css = `@font-face {\n\tfont-family: ${family};\n\tsrc: url("data:${mediaTypeFromExt(ext)};base64,${contents.toString("base64")}") format(${hint});\n}`;
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
            createSugarCube2MediaPassage(
                fileparts[0],
                ext,
                contents,
                "Twine.image"
            )
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
            createSugarCube2MediaPassage(
                fileparts[0],
                ext,
                contents,
                "Twine.audio"
            )
        );
    } else if (ext === "mp4" || ext === "ogv" || ext === "webm") {
        story.passages.push(
            createSugarCube2MediaPassage(
                fileparts[0],
                ext,
                contents,
                "Twine.video"
            )
        );
    } else if (ext === "vtt") {
        story.passages.push(
            createSugarCube2MediaPassage(
                fileparts[0],
                ext,
                contents,
                "Twine.vtt"
            )
        );
    }
}
