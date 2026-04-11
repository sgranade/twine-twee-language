import "mocha";
import { expect } from "chai";

import { Story } from "../../build/types";
import * as uut from "../../build/twee-parser";

describe("Client Twine Parser", () => {
    describe("Passages", () => {
        describe("General", () => {
            it("should parse a simple passage", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 \nP1 contents";

                uut.parseTwee3(story, text);
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

            it("should properly decode escaped characters", () => {
                const story: Story = { passages: [] };
                const text = ":: \\[Passage\\] \\1 \nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].name;

                expect(result).to.eql("[Passage] 1");
            });

            it("should parse the passage's tag names", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 [tag-1  tag_2]\nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].tags;

                expect(result).to.eql(["tag-1", "tag_2"]);
            });

            it("should ignore repeated tag names", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 [tag-1  tag_2 tag-1]\nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].tags;

                expect(result).to.eql(["tag-1", "tag_2"]);
            });

            it("should capture tags with escaped metacharacters", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 [tag-1 \\[tag_2\\]]\nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].tags;

                expect(result).to.eql(["tag-1", "[tag_2]"]);
            });

            it("should mark a passage with the script tag as being a script passage", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 [script] \nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].isScript;

                expect(result).to.be.true;
            });

            it("should mark a passage with the stylesheet tag as being a stylesheet passage", () => {
                const story: Story = { passages: [] };
                const text = ":: Passage 1 [stylesheet] \nP1 contents";

                uut.parseTwee3(story, text);
                const result = story.passages[0].isStylesheet;

                expect(result).to.be.true;
            });

            it("should parse the passage's metadata", () => {
                const story: Story = { passages: [] };
                const text =
                    ':: Passage 1 {"position":"600,400", "size":"100,200"}\nP1 contents';

                uut.parseTwee3(story, text);
                const result = story.passages[0].metadata;

                expect(result).to.eql({
                    position: "600,400",
                    size: "100,200",
                });
            });

            it("should parse both tags and metadata", () => {
                const story: Story = { passages: [] };
                const text =
                    ':: Passage 1 [tag-1] {"position":"600,400"}\nP1 contents';

                uut.parseTwee3(story, text);
                const result = story.passages;

                expect(result).to.eql([
                    {
                        name: "Passage 1",
                        isScript: false,
                        isStylesheet: false,
                        tags: ["tag-1"],
                        metadata: {
                            position: "600,400",
                        },
                        text: "P1 contents",
                    },
                ]);
            });

            it("should parse multiple passages", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: Passage 1 \nP1 contents\n:: Passage 2 [tagged]\nStuff in passage 2.";

                uut.parseTwee3(story, text);
                const result = story.passages;

                expect(result).to.eql([
                    {
                        name: "Passage 1",
                        isScript: false,
                        isStylesheet: false,
                        text: "P1 contents",
                    },
                    {
                        name: "Passage 2",
                        isScript: false,
                        isStylesheet: false,
                        tags: ["tagged"],
                        text: "Stuff in passage 2.",
                    },
                ]);
            });

            it("should parse multiple passages, even on Windows", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: Passage 1 \r\nP1 contents\r\n:: Passage 2 [tagged]\r\nStuff in passage 2.";

                uut.parseTwee3(story, text);
                const result = story.passages;

                expect(result).to.eql([
                    {
                        name: "Passage 1",
                        isScript: false,
                        isStylesheet: false,
                        text: "P1 contents",
                    },
                    {
                        name: "Passage 2",
                        isScript: false,
                        isStylesheet: false,
                        tags: ["tagged"],
                        text: "Stuff in passage 2.",
                    },
                ]);
            });
        });

        describe("Special Passages", () => {
            it("should set the story's title from a StoryTitle passage", () => {
                const story: Story = { passages: [] };
                const text = ":: StoryTitle \n Sweet title! \n";

                uut.parseTwee3(story, text);
                const result = story.name;

                expect(result).to.eql("Sweet title!");
            });

            it("should set the story's ifid from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                });
            });

            it("should set the story's format from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC",\n' +
                    '\t"format": "MySuperSweetFormat"\n' +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                    storyFormat: {
                        format: "MySuperSweetFormat",
                    },
                });
            });

            it("should set the story's format version from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC",\n' +
                    '\t"format": "MySuperSweetFormat",\n' +
                    '\t"format-version": "17.2"\n' +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                    storyFormat: {
                        format: "MySuperSweetFormat",
                        formatVersion: "17.2",
                    },
                });
            });

            it("should set the story's start passage from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC",\n' +
                    '\t"start": "17.2"\n' +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                    start: "17.2",
                });
            });

            it("should set the story's tag colors from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC",\n' +
                    '\t"tag-colors": {\n' +
                    '\t\t"tag-1": "black"\n' +
                    "\t}\n" +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                    tagColors: { "tag-1": "black" },
                });
            });

            it("should set the story's zoom level from a StoryData passage", () => {
                const story: Story = { passages: [] };
                const text =
                    ":: StoryData \n" +
                    "{\n" +
                    '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC",\n' +
                    '\t"zoom": 0.83\n' +
                    "}\n\n" +
                    ":: NextPassage\nContent";

                uut.parseTwee3(story, text);
                const result = story.storyData;

                expect(result).to.eql({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                    zoom: 0.83,
                });
            });
        });

        describe("Errors", () => {
            describe("Passages", () => {
                describe("General", () => {
                    it("should error on passages with metadata before tags", () => {
                        const story: Story = { passages: [] };
                        const text =
                            ':: Passage 1 {"position":"600,400"} [tag]\nP1 contents';

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "Tags need to come before metadata"
                        );
                        expect(result.start).to.eql(36);
                        expect(result.end).to.eql(41);
                    });

                    it("should error on passages with text after metadata", () => {
                        const story: Story = { passages: [] };
                        const text =
                            ':: Passage 1 {"position":"600,400"} Bad!\nP1 contents';

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "No text allowed after passage tags or metadata"
                        );
                        expect(result.start).to.eql(36);
                        expect(result.end).to.eql(40);
                    });

                    it("should error on passages with text after tags", () => {
                        const story: Story = { passages: [] };
                        const text = ":: Passage 1 [tag1] Bad!\nP1 contents";

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "No text allowed after passage tags or metadata"
                        );
                        expect(result.start).to.eql(20);
                        expect(result.end).to.eql(24);
                    });

                    it("should error on passages with names containing unescaped link markup metacharacters", () => {
                        const story: Story = { passages: [] };
                        const text = ":: Passage ] 1 } Bad!\nP1 contents";

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "Passage names can't include ] without a \\ in front of it"
                        );
                        expect(result.start).to.eql(11);
                        expect(result.end).to.eql(12);
                    });

                    it("should error on passages with unclosed tags", () => {
                        const story: Story = { passages: [] };
                        const text = ":: Passage 1 [nopers\nP1 contents";

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "Tags aren't formatted correctly"
                        );
                        expect(result.start).to.eql(13);
                        expect(result.end).to.eql(20);
                    });

                    it("should error on passages with unclosed metadata", () => {
                        const story: Story = { passages: [] };
                        const text = ':: Passage 1 {"nopers": 7\nP1 contents';

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.eql(
                            "Metadata isn't formatted correctly"
                        );
                        expect(result.start).to.eql(13);
                        expect(result.end).to.eql(25);
                    });

                    it("should error on passages with badly-formatted metadata", () => {
                        const story: Story = { passages: [] };
                        const text = ':: Passage 1 {"nopers"}\nP1 contents';

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.include(
                            "Couldn't parse metadata:"
                        );
                        expect(result.start).to.eql(13);
                        expect(result.end).to.eql(23);
                    });
                });

                describe("Special Passages", () => {
                    it("should error on badly formatted StoryData", () => {
                        const story: Story = { passages: [] };
                        const text = ':: StoryData\n{"nopers"}';

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.include(
                            "Couldn't parse StoryData passage:"
                        );
                        expect(result.start).to.eql(12);
                        expect(result.end).to.eql(23);
                    });

                    it("should error on a StoryData passage without an ifid", () => {
                        const story: Story = { passages: [] };
                        const text =
                            ":: StoryData \n" +
                            "{\n" +
                            "}\n\n" +
                            ":: NextPassage\nContent";

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.include(
                            "StoryData passage is missing an IFID value"
                        );
                        expect(result.start).to.eql(13);
                        expect(result.end).to.eql(19);
                    });

                    it("should error on a badly formatted ifid in a StoryData passage", () => {
                        const story: Story = { passages: [] };
                        const text =
                            ":: StoryData \n" +
                            "{\n" +
                            '\t"ifid": "nopers"\n' +
                            "}\n\n" +
                            ":: NextPassage\nContent";

                        let result: uut.TweeParseError;
                        try {
                            uut.parseTwee3(story, text);
                        } catch (e) {
                            result = e;
                        }

                        expect(result.message).to.include(
                            "StoryData passage has a badly-formatted IFID value: nopers"
                        );
                        expect(result.start).to.eql(13);
                        expect(result.end).to.eql(37);
                    });
                });
            });
        });
    });
});
