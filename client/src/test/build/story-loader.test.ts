import "mocha";
import { expect } from "chai";

import { Story } from "../../build/types";
import * as uut from "../../build/story-loader";

describe("Twee Story File Loader", () => {
    it("should load a twee file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from(":: Passage 1 \nP1 contents");
        const filename = "sample.twee";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "Passage 1",
                isScript: false,
                isStylesheet: false,
                text: "P1 contents",
            },
        ]);
    });

    it("should load a tw file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from(":: Passage 1 \nP1 contents");
        const filename = "sample.tw";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "Passage 1",
                isScript: false,
                isStylesheet: false,
                text: "P1 contents",
            },
        ]);
    });

    it("should load an otf file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really a font");
        const filename = "sample.otf";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample.otf",
                isScript: false,
                isStylesheet: true,
                text: '@font-face {\n\tfont-family: sample;\n\tsrc: url("data:font/otf;base64,Tm90IHJlYWxseSBhIGZvbnQ=") format(opentype);\n}',
                tags: ["stylesheet"],
            },
        ]);
    });

    it("should load a ttf file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really a font");
        const filename = "sample.ttf";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample.ttf",
                isScript: false,
                isStylesheet: true,
                text: '@font-face {\n\tfont-family: sample;\n\tsrc: url("data:font/ttf;base64,Tm90IHJlYWxseSBhIGZvbnQ=") format(truetype);\n}',
                tags: ["stylesheet"],
            },
        ]);
    });

    it("should load a woff file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really a font");
        const filename = "sample.woff";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample.woff",
                isScript: false,
                isStylesheet: true,
                text: '@font-face {\n\tfont-family: sample;\n\tsrc: url("data:font/woff;base64,Tm90IHJlYWxseSBhIGZvbnQ=") format(woff);\n}',
                tags: ["stylesheet"],
            },
        ]);
    });

    it("should load a woff2 file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really a font");
        const filename = "sample.woff2";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample.woff2",
                isScript: false,
                isStylesheet: true,
                text: '@font-face {\n\tfont-family: sample;\n\tsrc: url("data:font/woff2;base64,Tm90IHJlYWxseSBhIGZvbnQ=") format(woff2);\n}',
                tags: ["stylesheet"],
            },
        ]);
    });

    it("should load a gif file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.gif";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/gif;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a jpeg file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.jpeg";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/jpeg;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a jpg file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.jpg";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/jpeg;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a png file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.png";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/png;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a svg file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.svg";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/svg+xml;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a tif file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.tif";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/tiff;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a tiff file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.tiff";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/tiff;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load a webp file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really an image");
        const filename = "sample.webp";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:image/webp;base64,Tm90IHJlYWxseSBhbiBpbWFnZQ==",
                tags: ["Twine.image"],
            },
        ]);
    });

    it("should load an aac file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.aac";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/aac;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load a flac file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.flac";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/flac;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an m4a file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.m4a";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/mp4;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an mp3 file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.mp3";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/mpeg;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an oga file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.oga";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/ogg;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an ogg file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.ogg";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/ogg;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an opus file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.opus";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/ogg;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load a wav file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.wav";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/wav;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load a wave file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.wave";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/wav;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load a weba file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really audio");
        const filename = "sample.weba";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:audio/webm;base64,Tm90IHJlYWxseSBhdWRpbw==",
                tags: ["Twine.audio"],
            },
        ]);
    });

    it("should load an mp4 file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really video");
        const filename = "sample.mp4";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:video/mp4;base64,Tm90IHJlYWxseSB2aWRlbw==",
                tags: ["Twine.video"],
            },
        ]);
    });

    it("should load an ogv file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really video");
        const filename = "sample.ogv";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:video/ogg;base64,Tm90IHJlYWxseSB2aWRlbw==",
                tags: ["Twine.video"],
            },
        ]);
    });

    it("should load a webm file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really video");
        const filename = "sample.webm";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:video/webm;base64,Tm90IHJlYWxseSB2aWRlbw==",
                tags: ["Twine.video"],
            },
        ]);
    });

    it("should load a vtt file", () => {
        const story: Story = { passages: [] };
        const contents = Buffer.from("Not really a video text track");
        const filename = "sample.vtt";

        uut.addFileToStory(story, filename, contents);
        const result = story.passages;

        expect(result).to.eql([
            {
                name: "sample",
                isScript: false,
                isStylesheet: true,
                text: "data:text/vtt;base64,Tm90IHJlYWxseSBhIHZpZGVvIHRleHQgdHJhY2s=",
                tags: ["Twine.vtt"],
            },
        ]);
    });
});
