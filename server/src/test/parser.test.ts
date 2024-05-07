import { expect } from "chai";
import "mocha";
import { Diagnostic, Range, Position, Location } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../embedded-languages";
import { Passage, StoryData } from "../index";
import * as uut from "../parser";

class MockCallbacks implements uut.ParserCallbacks {
    public passages: Passage[] = [];
    public passageContents: string[] = [];
    public storyTitle?: string;
    public storyTitleRange?: Range;
    public storyData?: StoryData;
    public storyDataRange?: Range;
    public embeddedDocuments: EmbeddedDocument[] = [];
    public errors: Diagnostic[] = [];

    onPassage(passage: Passage, contents: string): void {
        this.passages.push(passage);
        this.passageContents.push(contents);
    }
    onStoryTitle(title: string, range: Range): void {
        this.storyTitle = title;
        this.storyTitleRange = range;
    }
    onStoryData(data: StoryData, range: Range): void {
        this.storyData = data;
        this.storyDataRange = range;
    }
    onEmbeddedDocument(document: EmbeddedDocument): void {
        this.embeddedDocuments.push(document);
    }
    onParseError(error: Diagnostic): void {
        this.errors.push(error);
    }
}

function buildStoryData({
    ifid = "9F187C0A-AE64-465A-8B13-B30B9DE446E2",
    format = "Chapbook",
    formatVersion = "1.0.0",
    start = "Start",
    tagColors = { bar: "green" },
    zoom = 1.0,
}) {
    return {
        ifid: ifid,
        format: format,
        "format-version": formatVersion,
        start: start,
        "tag-colors": tagColors,
        zoom: zoom,
    };
}

describe("Parser", () => {
    describe("Passages", () => {
        describe("General", () => {
            it("should call back on a passage", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1\nP1 contents\n\n:: Passage 2\nP2 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages.length).to.equal(2);
            });

            it("should call back with the passage's name", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 \nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].name.contents).to.equal(
                    "Passage 1"
                );
            });

            it("should properly decode escaped characters", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: \\[Passage\\] \\1 \nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].name.contents).to.equal(
                    "[Passage] 1"
                );
            });

            it("should call back with the passage name's location", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 \nP1 contents"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].name.location;
                expect(result.range.start).to.eql(Position.create(0, 3));
                expect(result.range.end).to.eql(Position.create(0, 12));
            });

            it("should call back with the passage's tag names and locations captured", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [tag-1  tag_2]\nP1 contents"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].tags;

                expect(result).to.eql([
                    {
                        contents: "tag-1",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 14, 0, 19)
                        ),
                    },
                    {
                        contents: "tag_2",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 21, 0, 26)
                        ),
                    },
                ]);
            });

            it("should ignore repeated tags", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [tag-1 tag_2 tag-1]\nP1 contents"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].tags?.map(
                    (x) => x.contents
                );

                expect(result).to.eql(["tag-1", "tag_2"]);
            });

            it("should capture passage tags with escaped metacharacters", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [tag-1 \\[tag_2\\]]\nP1 contents"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].tags;

                expect(result).to.eql([
                    {
                        contents: "tag-1",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 14, 0, 19)
                        ),
                    },
                    {
                        contents: "[tag_2]",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 20, 0, 29)
                        ),
                    },
                ]);
            });

            it("should call back on passages with the script tag with the passage's isScript set", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [script]\nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].isScript).to.be.true;
            });

            it("should call back on passages without the script tag with the passage's isScript not set", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [not-a-script]\nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].isScript).to.be.false;
            });

            it("should call back on passages with the stylesheet tag with the passage's isStylesheet set", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [stylesheet]\nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].isStylesheet).to.be.true;
            });

            it("should call back on passages without the stylesheet tag with the passage's isStylesheet not set", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [not-a-stylesheet]\nP1 contents"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.passages[0].isStylesheet).to.be.false;
            });

            it("should call back with the passage's metadata captured", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ':: Passage 1 {"position":"600,400", "size":"100,200"}\nP1 contents'
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0];

                expect(result.metadata).to.eql({
                    raw: {
                        contents: '{"position":"600,400", "size":"100,200"}',
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 13, 0, 53)
                        ),
                    },
                    position: "600,400",
                    size: "100,200",
                });
            });

            it("should call back with both the passage's tags and metadata", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ':: Passage 1 [tag-1] {"position":"600,400"}\nP1 contents'
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0];

                expect(result.tags).to.eql([
                    {
                        contents: "tag-1",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 14, 0, 19)
                        ),
                    },
                ]);
                expect(result.metadata).to.eql({
                    raw: {
                        contents: '{"position":"600,400"}',
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 21, 0, 43)
                        ),
                    },
                    position: "600,400",
                });
            });

            it("should call back with the passage's scope", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 \nP1 contents"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].scope;

                expect(result.start).to.eql(Position.create(0, 0));
                expect(result.end).to.eql(Position.create(1, 11));
            });

            it("should set a passage's scope to end before the next one", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 \nP1 contents\n:: Passage 2"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].scope;

                expect(result.start).to.eql(Position.create(0, 0));
                expect(result.end).to.eql(Position.create(1, 11));
            });

            it("should set a passage's scope to end before the next one, even on Windows", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 \r\nP1 contents\r\n:: Passage 2"
                );

                uut.parse(doc, callbacks);
                const result = callbacks.passages[0].scope;

                expect(result.start).to.eql(Position.create(0, 0));
                expect(result.end).to.eql(Position.create(1, 11));
            });
        });

        describe("Special Passages", () => {
            it("should call back on StoryTitle with the story's title", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryTitle\nSweet title!\n"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyTitle).to.eql("Sweet title!");
            });

            it("should call back on StoryTitle with the title's range", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryTitle\nSweet title!"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyTitleRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyTitleRange?.end).to.eql(
                    Position.create(1, 12)
                );
            });

            it("should call back on StoryTitle with the title's range, even on Windows", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryTitle\r\nSweet title!"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyTitleRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyTitleRange?.end).to.eql(
                    Position.create(1, 12)
                );
            });

            it("should call back on StoryData with the data's range", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyDataRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyDataRange?.end).to.eql(
                    Position.create(3, 1)
                );
            });

            it("should call back on StoryData with the data's range, even on Windows", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\r\n" +
                        "{\r\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\r\n' +
                        "}\r\n"
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyDataRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyDataRange?.end).to.eql(
                    Position.create(3, 1)
                );
            });

            it("should call back on StoryData with the IFID included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    ifid: "62891577-8D8E-496F-B46C-9FF0194C0EAC",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.ifid).to.eql(
                    "62891577-8D8E-496F-B46C-9FF0194C0EAC"
                );
            });

            it("should call back on StoryData with the format included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    format: "MySuperSweetFormat",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.format).to.eql(
                    "MySuperSweetFormat"
                );
            });

            it("should call back on StoryData with the format version included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    formatVersion: "17.2",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.formatVersion).to.eql("17.2");
            });

            it("should call back on StoryData with the start passage included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    start: "17.2",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.start).to.eql("17.2");
            });

            it("should call back on StoryData with the tag colors included", () => {
                const callbacks = new MockCallbacks();
                const storyData = {
                    ifid: "9F187C0A-AE64-465A-8B13-B30B9DE446E2",
                    "tag-colors": {
                        "tag-1": "black",
                    },
                };
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.tagColors).to.eql(
                    new Map([["tag-1", "black"]])
                );
            });

            it("should call back on StoryData with the zoom level included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({ zoom: 0.83 });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks);

                expect(callbacks.storyData?.zoom).to.eql(0.83);
            });
        });
    });

    describe("Errors", () => {
        describe("Passages", () => {
            describe("General", () => {
                it("should flag passages with metadata before tags", () => {
                    const callbacks = new MockCallbacks();
                    const doc = TextDocument.create(
                        "fake-uri",
                        "",
                        0,
                        ':: Passage 1 {"position":"600,400"} [tag]\nP1 contents'
                    );

                    uut.parse(doc, callbacks);

                    expect(callbacks.errors.length).to.equal(1);
                    expect(callbacks.errors[0].message).to.include(
                        "Tags need to come before metadata"
                    );
                    expect(callbacks.errors[0].range).to.eql(
                        Range.create(0, 36, 0, 41)
                    );
                });

                it("should flag passages with text after metadata", () => {
                    const callbacks = new MockCallbacks();
                    const doc = TextDocument.create(
                        "fake-uri",
                        "",
                        0,
                        ':: Passage 1 {"position":"600,400"} Bad!\nP1 contents'
                    );

                    uut.parse(doc, callbacks);

                    expect(callbacks.errors.length).to.equal(1);
                    expect(callbacks.errors[0].message).to.include(
                        "Passage headers can't have text after metadata"
                    );
                    expect(callbacks.errors[0].range).to.eql(
                        Range.create(0, 36, 0, 40)
                    );
                });

                it("should flag passages with text after tags when there is no metadata", () => {
                    const callbacks = new MockCallbacks();
                    const doc = TextDocument.create(
                        "fake-uri",
                        "",
                        0,
                        ":: Passage 1 [tag1] Bad!\nP1 contents"
                    );

                    uut.parse(doc, callbacks);

                    expect(callbacks.errors.length).to.equal(1);
                    expect(callbacks.errors[0].message).to.include(
                        "Passage headers can't have text after tags"
                    );
                    expect(callbacks.errors[0].range).to.eql(
                        Range.create(0, 20, 0, 24)
                    );
                });

                it("should flag passages with names containing unescaped link markup metacharacters", () => {
                    const callbacks = new MockCallbacks();
                    const doc = TextDocument.create(
                        "fake-uri",
                        "",
                        0,
                        ":: Passage ] 1 } Bad!\nP1 contents"
                    );

                    uut.parse(doc, callbacks);

                    expect(callbacks.errors.length).to.equal(2);
                    expect(callbacks.errors[0].message).to.include(
                        "Passage names can't include ] without a \\ in front of it"
                    );
                    expect(callbacks.errors[0].range).to.eql(
                        Range.create(0, 11, 0, 12)
                    );
                    expect(callbacks.errors[1].message).to.include(
                        "Passage names can't include } without a \\ in front of it"
                    );
                    expect(callbacks.errors[1].range).to.eql(
                        Range.create(0, 15, 0, 16)
                    );
                });

                it("should flag passages with badly-formatted tags", () => {
                    const callbacks = new MockCallbacks();
                    const doc = TextDocument.create(
                        "fake-uri",
                        "",
                        0,
                        ":: Passage 1 [nopers\nP1 contents"
                    );

                    uut.parse(doc, callbacks);

                    expect(callbacks.errors.length).to.equal(1);
                    expect(callbacks.errors[0].message).to.include(
                        "Tags aren't formatted correctly."
                    );
                    expect(callbacks.errors[0].range).to.eql(
                        Range.create(0, 13, 0, 20)
                    );
                });
            });
        });
    });
});
