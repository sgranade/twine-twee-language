import { CLIENT_VERSION } from "../version";
import { TweeParseError } from "./twee-parser";
import { Passage, Story } from "./types";
import { escapeAttrEntities, escapeHtmlEntities } from "./utilities";

/**
 * Decode a Twine 2 story format and get its source.
 *
 * @param storyFormat Contents of the story format file.
 * @returns The contents of the story format's source.
 * @throws Error if the story format can't be decoded.
 */
function getStoryFormatSource(storyFormatContents: string): string {
    // Extract the JSON from inside the format's `window.storyFormat()` call.
    const start = storyFormatContents.indexOf("{");
    const end = storyFormatContents.lastIndexOf("}");
    if (start === -1 || end === -1) {
        throw new Error(
            "Couldn't find the JSON part of the story format. Is it a Twine 2 story format?"
        );
    }
    const rawJson = storyFormatContents.slice(start, end + 1);
    let format: any;
    try {
        format = JSON.parse(rawJson);
    } catch (err) {
        // Harlowe has a "setup" entry that's not true JSON (it's a setup function).
        // We can hack around it by dropping that entry and trying the parse again.
        const setupEntryIndex =
            storyFormatContents.indexOf(',"setup": function');
        if (setupEntryIndex !== -1) {
            try {
                format = JSON.parse(rawJson.slice(0, setupEntryIndex) + "}");
            } catch (suberr) {
                throw new Error(
                    `Couldn't decode the story format's JSON: ${suberr.message}`
                );
            }
        }
        throw new Error(
            `Couldn't decode the story format's JSON: ${err.message}`
        );
    }
    if (typeof format["source"] !== "string") {
        throw new Error(
            `Couldn't find the "source" key in the story format. Is it a Twine 2 story format?`
        );
    }

    return format["source"];
}

/**
 * Create a <tw-passagedata> tag from a passage.
 *
 * @param p Passage to convert.
 * @param pid Passage ID to assign it.
 * @returns <tw-passagedata> tag corresponding to the passage.
 */
function passageToHtml(p: Passage, pid: number): string {
    let position: string;
    let size: string;

    if (p.metadata?.position) {
        position = p.metadata.position;
    } else {
        // Create a position value that matches Tweego's
        let x = Math.floor(pid % 10);
        let y = Math.floor(pid / 10);
        if (x === 0) {
            x = 10;
        } else {
            y++;
        }
        position = `${x * 125 - 25},${y * 125 - 25}`;
    }

    if (p.metadata?.size) {
        size = p.metadata.size;
    } else {
        // Create a size value that matches Tweego's
        size = "100,100";
    }

    const name = escapeAttrEntities(p.name);
    const tags = escapeAttrEntities((p.tags ?? []).join(" "));
    position = escapeAttrEntities(position);
    size = escapeAttrEntities(size);

    // <tw-passagedata pid="…" name="…" tags="…" position="…" size="…">…</tw-passagedata>
    return `<tw-passagedata pid="${pid}" name="${name}" tags="${tags}" position="${position}" size="${size}">${escapeHtmlEntities(p.text)}</tw-passagedata>`;
}

function storyToHtml(story: Story, options: Record<string, boolean>): string {
    let html = "";

    // Divide out the passages by function
    const scriptPassages: Passage[] = [];
    const stylesheetPassages: Passage[] = [];
    const contentPassages: Passage[] = [];

    for (const p of story.passages) {
        // We don't do anything with passages marked `Twine.private`
        if ((p.tags ?? []).includes("Twine.private")) {
            continue;
        }

        if (p.isScript) {
            scriptPassages.push(p);
        } else if (p.isStylesheet) {
            stylesheetPassages.push(p);
        } else if (p.name !== "StoryTitle" && p.name !== "StoryData") {
            contentPassages.push(p);
        }
    }

    // Build style element
    // <style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">…</style>
    html +=
        '<style role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">';
    for (const [ndx, p] of stylesheetPassages.entries()) {
        // If there are multiple stylesheets, separate them with `\n`
        if (ndx > 0 && html.slice(-1) !== "\n") {
            html += "\n";
        }
        html += `/* twine-user-stylesheet #${ndx + 1}: "${p.name}" */\n${p.text}`;
    }
    html += "</style>";

    // Build script element
    // <script role="script" id="twine-user-script" type="text/twine-javascript">…</script>
    html +=
        '<script role="script" id="twine-user-script" type="text/twine-javascript">';
    for (const [ndx, p] of scriptPassages.entries()) {
        // If there are multiple scripts, separate them with `\n`
        if (ndx > 0 && html.slice(-1) !== "\n") {
            html += "\n";
        }
        html += `/* twine-user-script #${ndx + 1}: "${p.name}" */\n${p.text}`;
    }
    html += "</script>";

    // Build tw-tag elements
    // <tw-tag name="…" color="…"></tw-tag>
    if (story.storyData.tagColors !== undefined) {
        for (const [tag, color] of Object.entries(story.storyData.tagColors)) {
            html += `<tw-tag name="${tag}" color="${color}"></tw-tag>`;
        }
    }

    // Build passage elements
    let startPassageId: number;
    for (const [ndx, p] of contentPassages.entries()) {
        html += passageToHtml(p, ndx + 1);
        if (p.name === story.storyData.start) {
            startPassageId = ndx + 1;
        }
    }

    // Create tw-storydata element that wraps the story content
    // <tw-storydata name="…" startnode="…" creator="…" creator-version="…" ifid="…"
    //      zoom="…" format="…" format-version="…" options="…" hidden>…</tw-storydata>
    const name = escapeAttrEntities(story.name ?? "");
    const creator = escapeAttrEntities("Twine (Twee 3) Language");
    const creatorVersion = escapeAttrEntities(CLIENT_VERSION);
    const ifid = escapeAttrEntities(story.storyData.ifid);
    const format = escapeAttrEntities(story.storyData.storyFormat.format);
    const formatVersion = escapeAttrEntities(
        story.storyData.storyFormat.formatVersion
    );
    let optionsArr: string[] = [];
    for (const [option, val] of Object.entries(options)) {
        if (val) optionsArr.push(option);
    }
    const optionsStr = escapeAttrEntities(optionsArr.join(" "));
    html =
        `<!-- UUID://${story.storyData.ifid}// -->` +
        `<tw-storydata name="${name}" startnode="${startPassageId}" creator="${creator}" ` +
        `creator-version="${creatorVersion}" ifid="${ifid}" zoom="${story.storyData.zoom ?? ""}" ` +
        `format="${format}" format-version="${formatVersion}" options="${optionsStr}" hidden>${html}`;

    html += "</tw-storydata>";

    return html;
}

/**
 * Compile a story to HTML using a given story format.
 *
 * @param story Story to compile.
 * @param storyFormatContents The story format's contents.
 * @param options Additional options to set in the story data element that contains the story.
 * @returns The story compiled to the given story format.
 * @throws Error if the compilation fails. If it's from Twee parsing, the error will be a {@link TweeParseError}.
 */
export function compileStory(
    story: Story,
    storyFormatContents: string,
    options: Record<string, boolean>
): string {
    let template = getStoryFormatSource(storyFormatContents);

    // Set the name
    template = template.replace(
        /\{\{STORY_NAME\}\}/g,
        escapeHtmlEntities(story.name)
    );

    // Set the story data
    template = template.replace("{{STORY_DATA}}", storyToHtml(story, options));

    return template;
}
