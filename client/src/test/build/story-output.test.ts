import "mocha";
import { expect } from "chai";

import { StoryFormat } from "../../client-server";
import { CLIENT_VERSION } from "../../version";
import { Passage, Story, StoryData } from "../../build/types";

import * as uut from "../../build/story-output";

function buildPassage({
    name = "Passage Name",
    isScript = false,
    isStylesheet = false,
    text = "Passage Contents",
}): Passage {
    return { name, isScript, isStylesheet, text };
}

function buildStory({
    name = "Story Name",
    passages = [buildPassage({})],
    storyData = buildStoryData({}),
}): Story {
    return { name, passages, storyData };
}

function buildStoryData({
    ifid = "9F187C0A-AE64-465A-8B13-B30B9DE446E2",
    format = "Chapbook",
    formatVersion = "1.0.0",
    start = "Start",
    tagColors = { bar: "green" },
    zoom = 1.0,
}): StoryData {
    return {
        ifid: ifid,
        storyFormat: { format, formatVersion },
        start: start,
        tagColors: tagColors,
        zoom: zoom,
    };
}

function buildStoryFormat({
    format = "MyFormat",
    formatVersion = "1.2.3",
    content = '{"source": "{{STORY_DATA}}"}',
}): [StoryFormat, Buffer] {
    return [{ format, formatVersion }, Buffer.from(content)];
}

describe("Story Output", () => {
    it("should set the game's name", () => {
        const story = buildStory({ name: "Swe&t Name" });
        const storyFormatData =
            '{"source": "I have {{STORY_NAME}}, {{STORY_DATA}}, and {{STORY_NAME}}."}';

        const result = uut.compileStory(story, storyFormatData, {});

        expect(result).to.include("I have Swe&amp;t Name,");
        expect(result).to.include(", and Swe&amp;t Name.");
    });

    it("should set the game's tw-storydata tag", () => {
        const story = buildStory({
            name: "Game Name",
            storyData: buildStoryData({
                ifid: "sweet-if'id",
                format: "<MyFormat>",
                formatVersion: "1.2.3",
                start: "NewStart",
                zoom: 0.72,
            }),
        });
        story.passages = [
            buildPassage({ name: "Sample" }),
            buildPassage({ name: "NewStart" }),
        ];
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const result = uut
            .compileStory(story, storyFormatData, {
                debug: true,
                another: true,
                ignored: false,
            })
            .split(" hidden>")[0];

        expect(result).to.equal(
            "<!-- UUID://sweet-if'id// -->" +
                `<tw-storydata name="Game Name" startnode="2" creator="Twine (Twee 3) Language" creator-version="${CLIENT_VERSION}" ifid="sweet-if&#39;id" zoom="0.72" format="<MyFormat>" format-version="1.2.3" options="debug another"`
        );
    });

    it("should set an empty stylesheet if there is no stylesheet passage", () => {
        const story = buildStory({});
        story.passages = [buildPassage({ name: "Start", isStylesheet: false })];
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<style (.*?)<\/style>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            'role="stylesheet" id="twine-user-stylesheet" type="text/twine-css">'
        );
    });

    it("should put a stylesheet passage in the stylesheet element", () => {
        const story = buildStory({});
        story.passages.push(
            buildPassage({
                name: "Stylish",
                isStylesheet: true,
                text: "stylin'",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<style.*?>(.*?)<\/style>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-stylesheet #1: "Stylish" */\nstylin\''
        );
    });

    it("should put multiple stylesheet passages in the stylesheet element", () => {
        const story = buildStory({});
        story.passages.push(
            buildPassage({
                name: "Stylish",
                isStylesheet: true,
                text: "stylin'",
            }),
            buildPassage({
                name: "Style 2",
                isStylesheet: true,
                text: "so stylish",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<style.*?>(.*?)<\/style>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-stylesheet #1: "Stylish" */\nstylin\'\n' +
                '/* twine-user-stylesheet #2: "Style 2" */\nso stylish'
        );
    });

    it("should ignore stylesheet passages tagged with Twine.private", () => {
        const story = buildStory({});
        const p1 = buildPassage({
            name: "Stylish",
            isStylesheet: true,
            text: "stylin'",
        });
        p1.tags = ["Twine.private"];
        story.passages.push(
            p1,
            buildPassage({
                name: "Style 2",
                isStylesheet: true,
                text: "so stylish",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<style.*?>(.*?)<\/style>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-stylesheet #1: "Style 2" */\nso stylish'
        );
    });

    it("should set an empty script element if there is no script passage", () => {
        const story = buildStory({});
        story.passages = [buildPassage({ name: "Start", isScript: false })];
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<script (.*?)<\/script>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            'role="script" id="twine-user-script" type="text/twine-javascript">'
        );
    });

    it("should put a script passage in the script element", () => {
        const story = buildStory({});
        story.passages.push(
            buildPassage({
                name: "Scripty",
                isScript: true,
                text: "scriptin'",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<script.*?>(.*?)<\/script>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-script #1: "Scripty" */\nscriptin\''
        );
    });

    it("should put multiple script passages in the script element", () => {
        const story = buildStory({});
        story.passages.push(
            buildPassage({
                name: "Scripty",
                isScript: true,
                text: "scriptin'",
            }),
            buildPassage({
                name: "Script 2",
                isScript: true,
                text: "so scriptish",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<script.*?>(.*?)<\/script>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-script #1: "Scripty" */\nscriptin\'\n' +
                '/* twine-user-script #2: "Script 2" */\nso scriptish'
        );
    });

    it("should ignore script passages tagged with Twine.private", () => {
        const story = buildStory({});
        const p1 = buildPassage({
            name: "Scripty",
            isScript: true,
            text: "scriptin'",
        });
        p1.tags = ["Twine.private"];
        story.passages.push(
            p1,
            buildPassage({
                name: "Script 2",
                isScript: true,
                text: "so scriptish",
            })
        );
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = /<script.*?>(.*?)<\/script>/s.exec(html);
        const result = m[1];

        expect(result).to.equal(
            '/* twine-user-script #1: "Script 2" */\nso scriptish'
        );
    });

    it("should not include a tw-tag element if there are no tag colors", () => {
        const story = buildStory({});
        story.storyData.tagColors = undefined;
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const result = uut.compileStory(story, storyFormatData, {});

        expect(result).to.not.include("<tw-tag");
    });

    it("should include a tw-tag element for each tag color", () => {
        const story = buildStory({});
        story.storyData.tagColors = {
            ex1: "chartreuse",
            another: "ochre",
        };
        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = [...html.matchAll(/<tw-tag (.*?)><\/tw-tag>/g)];
        const [result_ex1, result_another] = m;

        expect(m.length).to.equal(2);
        expect(result_ex1[1]).to.equal('name="ex1" color="chartreuse"');
        expect(result_another[1]).to.equal('name="another" color="ochre"');
    });

    it("should include a tw-passagedata for each passage", () => {
        const story = buildStory({});
        story.passages = [
            buildPassage({
                name: "A very <passage",
                text: ">text< goes here",
            }),
            buildPassage({
                name: "What? A 'passage' & stuff?",
                text: "This has 'info'.",
            }),
            buildPassage({
                name: "Start",
                text: "Gonna start here.",
            }),
        ];
        story.passages[1].tags = ["tag1", "tag2"];

        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = [
            ...html.matchAll(/<tw-passagedata (.*?)>(.*?)<\/tw-passagedata>/g),
        ];
        const [result_p0, result_p1, result_p2] = m;

        expect(m.length).to.equal(3);
        expect(result_p0[1]).to.equal(
            'pid="1" name="A very <passage" tags="" position="100,100" size="100,100"'
        );
        expect(result_p0[2]).to.equal("&gt;text&lt; goes here");
        expect(result_p1[1]).to.equal(
            'pid="2" name="What? A &#39;passage&#39; &amp; stuff?" tags="tag1 tag2" position="225,100" size="100,100"'
        );
        expect(result_p1[2]).to.equal("This has &#39;info&#39;.");
        expect(result_p2[1]).to.equal(
            'pid="3" name="Start" tags="" position="350,100" size="100,100"'
        );
        expect(result_p2[2]).to.equal("Gonna start here.");
    });

    it("should not make tw-passagedata for script passages", () => {
        const story = buildStory({});
        story.passages = [
            buildPassage({
                name: "Scripty",
                isScript: true,
                text: "I dunno, script stuff.",
            }),
            buildPassage({
                name: "Start",
                text: "Gonna start here.",
            }),
        ];

        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = [
            ...html.matchAll(/<tw-passagedata (.*?)>(.*?)<\/tw-passagedata>/g),
        ];
        const [result_p0] = m;

        expect(m.length).to.equal(1);
        expect(result_p0[1]).to.equal(
            'pid="1" name="Start" tags="" position="100,100" size="100,100"'
        );
        expect(result_p0[2]).to.equal("Gonna start here.");
    });

    it("should not make tw-passagedata for stylesheet passages", () => {
        const story = buildStory({});
        story.passages = [
            buildPassage({
                name: "Stylesheety",
                isScript: true,
                text: "I dunno, css box model or something.",
            }),
            buildPassage({
                name: "Start",
                text: "Gonna start here.",
            }),
        ];

        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = [
            ...html.matchAll(/<tw-passagedata (.*?)>(.*?)<\/tw-passagedata>/g),
        ];
        const [result_p0] = m;

        expect(m.length).to.equal(1);
        expect(result_p0[1]).to.equal(
            'pid="1" name="Start" tags="" position="100,100" size="100,100"'
        );
        expect(result_p0[2]).to.equal("Gonna start here.");
    });

    it("should not make tw-passagedata for passages with the Twine.private tag", () => {
        const story = buildStory({});
        story.passages = [
            buildPassage({
                name: "A passage to ignore",
                text: "Shouldn't include this.",
            }),
            buildPassage({
                name: "Start",
                text: "Gonna start here.",
            }),
        ];
        story.passages[0].tags = ["Twine.private"];

        const storyFormatData = '{"source": "{{STORY_DATA}}"}';

        const html = uut.compileStory(story, storyFormatData, {});
        const m = [
            ...html.matchAll(/<tw-passagedata (.*?)>(.*?)<\/tw-passagedata>/g),
        ];
        const [result_p0] = m;

        expect(m.length).to.equal(1);
        expect(result_p0[1]).to.equal(
            'pid="1" name="Start" tags="" position="100,100" size="100,100"'
        );
        expect(result_p0[2]).to.equal("Gonna start here.");
    });
});
