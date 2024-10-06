import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";

import { Range, Position, Location } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { MockCallbacks, buildParsingState } from "./builders";
import * as ptpModule from "../passage-text-parsers";
import * as uut from "../parser";
import { StoryFormat } from "../client-server";
import { ETokenType } from "../tokens";
import { TwineSymbolKind } from "../project-index";

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

describe("Twine Parser", () => {
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.passages[0].isStylesheet).to.be.false;
            });

            it("should call back on stylesheet passages with an embedded passage", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1 [stylesheet]\nP1 contents"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
                const [result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql("P1 contents");
                expect(result.document.languageId).to.eql("css");
                expect(result.range).to.eql(Range.create(1, 0, 1, 11));
            });

            it("should call back with the passage's metadata captured", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ':: Passage 1 {"position":"600,400", "size":"100,200"}\nP1 contents'
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
                const [result] = callbacks.passages;

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

            it("should call back on passage metadata with an embedded passage", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ':: Passage 1 {"position":"600,400", "size":"100,200"}\nP1 contents'
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
                const [result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql(
                    '{"position":"600,400", "size":"100,200"}'
                );
                expect(result.document.languageId).to.eql("json");
                expect(result.range).to.eql(Range.create(0, 13, 0, 53));
            });

            it("should call back with both the passage's tags and metadata", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ':: Passage 1 [tag-1] {"position":"600,400"}\nP1 contents'
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
                const result = callbacks.passages[0].scope;

                expect(result.start).to.eql(Position.create(0, 0));
                expect(result.end).to.eql(Position.create(1, 11));
            });

            it("should call back on a passage even when told to parse Passage Names only", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1\nP1 contents\n"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.PassageNames);
                const [result] = callbacks.passages;

                expect(callbacks.passages.length).to.equal(1);
                expect(result.name.contents).to.eql("Passage 1");
                expect(result.scope).to.eql(Range.create(0, 0, 1, 11));
            });

            it("should not call back on a passage when told to parse StoryData only", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage 1\nP1 contents"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.StoryData);

                expect(callbacks.passages).to.be.empty;
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyTitleRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyTitleRange?.end).to.eql(
                    Position.create(1, 12)
                );
            });

            it("should call back on StoryTitle even if told to parse only passage names", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryTitle\r\nSweet title!"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.PassageNames);

                expect(callbacks.storyTitleRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyTitleRange?.end).to.eql(
                    Position.create(1, 12)
                );
            });

            it("should not call back on StoryTitle if told to parse only StoryData passages", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryTitle\r\nSweet title!"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.StoryData);

                expect(callbacks.storyTitleRange).to.be.undefined;
            });

            it("should call back on StoryData with an embedded passage", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n\n" +
                        ":: NextPassage\nContent"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);
                const [result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql(
                    "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n"
                );
                expect(result.document.languageId).to.eql("json");
                expect(result.range).to.eql(Range.create(1, 0, 4, 0));
            });

            it("should call back on StoryData with the data's range", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyDataRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyDataRange?.end).to.eql(
                    Position.create(3, 1)
                );
            });

            it("should call back on StoryData with the data's range, even on Windows", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\r\n" +
                        "{\r\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\r\n' +
                        "}\r\n"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyData?.storyFormat?.format).to.eql(
                    "MySuperSweetFormat"
                );
            });

            it("should call back on StoryData with the format version included", () => {
                const callbacks = new MockCallbacks();
                const storyData = buildStoryData({
                    format: "MySuperSweetFormat",
                    formatVersion: "17.2",
                });
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(
                    callbacks.storyData?.storyFormat?.formatVersion
                ).to.equal("17.2");
            });

            it("should not call back on StoryData with the format version if there is no story format", () => {
                const callbacks = new MockCallbacks();
                const storyData = {
                    ifid: "9F187C0A-AE64-465A-8B13-B30B9DE446E2",
                    "format-version": "17.2",
                };
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" + JSON.stringify(storyData, null, "\t")
                );

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyData?.storyFormat).to.be.undefined;
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyData?.tagColors).to.eql({
                    "tag-1": "black",
                });
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

                uut.parse(doc, callbacks, uut.ParseLevel.Full);

                expect(callbacks.storyData?.zoom).to.eql(0.83);
            });

            it("should call back on StoryData even if told to parse passage names only", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.PassageNames);

                expect(callbacks.storyDataRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyDataRange?.end).to.eql(
                    Position.create(3, 1)
                );
            });

            it("should call back on StoryData if told to parse StoryData only", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        "}\n"
                );

                uut.parse(doc, callbacks, uut.ParseLevel.StoryData);

                expect(callbacks.storyDataRange?.start).to.eql(
                    Position.create(1, 0)
                );
                expect(callbacks.storyDataRange?.end).to.eql(
                    Position.create(3, 1)
                );
            });
        });

        describe("Passage Text Parsing", () => {
            it("should parse passage text based on the initial story format", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nI am the passage contents!\n"
                );
                const receivedContents: string[] = [];
                const mockFunction = ImportMock.mockFunction(
                    ptpModule,
                    "getStoryFormatParser"
                ).callsFake((format: StoryFormat | undefined) => {
                    if (format?.format == "FakeFormat") {
                        return {
                            id: "FakeFormat",
                            parsePassageText: (passageText: string) => {
                                receivedContents.push(passageText);
                            },
                        };
                    }
                    return undefined;
                });

                uut.parse(doc, callbacks, uut.ParseLevel.Full, {
                    format: "FakeFormat",
                });
                mockFunction.restore();

                expect(receivedContents).to.eql([
                    "I am the passage contents!\n",
                ]);
            });

            it("should parse passage text based on the story format in the StoryData passage", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nI am the passage contents!\n\n" +
                        ":: StoryData\n" +
                        "{\n" +
                        '\t"ifid": "62891577-8D8E-496F-B46C-9FF0194C0EAC"\n' +
                        '\t"format": "FakeFormat"\n' +
                        "}\n\n" +
                        ":: Other Passage\nMe? Also contents!\n\n"
                );
                const receivedContents: string[] = [];
                const mockFunction = ImportMock.mockFunction(
                    ptpModule,
                    "getStoryFormatParser"
                ).callsFake((format: StoryFormat | undefined) => {
                    if (format?.format == "FakeFormat") {
                        return {
                            id: "FakeFormat",
                            parsePassageText: (passageText: string) => {
                                receivedContents.push(passageText);
                            },
                        };
                    }
                    return undefined;
                });

                uut.parse(doc, callbacks, uut.ParseLevel.Full, {
                    format: "FakeFormat",
                });
                mockFunction.restore();

                expect(receivedContents).to.eql([
                    "I am the passage contents!\n\n",
                    "Me? Also contents!\n\n",
                ]);
            });

            it("should set the current passage in the parsing state before parsing passage text", () => {
                const callbacks = new MockCallbacks();
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage to be parsed\nI am the passage contents!\n"
                );
                const receivedContents: string[] = [];
                const mockFunction = ImportMock.mockFunction(
                    ptpModule,
                    "getStoryFormatParser"
                ).callsFake((format: StoryFormat | undefined) => {
                    if (format?.format == "FakeFormat") {
                        return {
                            id: "FakeFormat",
                            parsePassageText: (
                                passageText: string,
                                textIndex: number,
                                state: uut.ParsingState
                            ) => {
                                receivedContents.push(
                                    state.currentPassage?.name.contents ||
                                        "nope!"
                                );
                            },
                        };
                    }
                    return undefined;
                });

                uut.parse(doc, callbacks, uut.ParseLevel.Full, {
                    format: "FakeFormat",
                });
                mockFunction.restore();

                expect(receivedContents).to.eql(["Passage to be parsed"]);
            });
        });

        describe("Links", () => {
            it("should produce no semantic tokens for an empty [[]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" + "Here it is: [[]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);

                expect(passageState.passageTokens).to.be.empty;
            });

            it("should set semantic tokens for a [[target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, 2, state, passageState);
                const result = passageState.passageTokens;

                expect(result).to.eql({
                    45: {
                        text: "target passage",
                        at: 45,
                        type: ETokenType.class,
                        modifiers: [],
                    },
                });
            });

            it("should capture the passage reference for a [[target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 15, 2, 29)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should not capture a passage reference for a [[target]] link that's a URL", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a URL link!\n" +
                    "Here it is: [[ https://herewe.go/ ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);
                const result = callbacks.references;

                expect(result).to.be.empty;
            });

            it("should set semantic tokens for a [[display|target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string | target passage]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, 2, state, passageState);
                const result = passageState.passageTokens;

                expect(result).to.eql({
                    44: {
                        text: "display w a string",
                        at: 44,
                        type: ETokenType.string,
                        modifiers: [],
                    },
                    63: {
                        text: "|",
                        at: 63,
                        type: ETokenType.keyword,
                        modifiers: [],
                    },
                    65: {
                        text: "target passage",
                        at: 65,
                        type: ETokenType.class,
                        modifiers: [],
                    },
                });
            });

            it("should capture the passage reference for a [[display|target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string | target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 35, 2, 49)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should set semantic tokens for a [[display->target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string -> target passage]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, 2, state, passageState);
                const result = passageState.passageTokens;

                expect(result).to.eql({
                    44: {
                        text: "display w a string",
                        at: 44,
                        type: ETokenType.string,
                        modifiers: [],
                    },
                    63: {
                        text: "->",
                        at: 63,
                        type: ETokenType.keyword,
                        modifiers: [],
                    },
                    66: {
                        text: "target passage",
                        at: 66,
                        type: ETokenType.class,
                        modifiers: [],
                    },
                });
            });

            it("should capture the passage reference for a [[display->target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string -> target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 36, 2, 50)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should set semantic tokens for a [[target<-display]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage <- display w a string ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, 2, state, passageState);
                const result = passageState.passageTokens;

                expect(result).to.eql({
                    45: {
                        text: "target passage",
                        at: 45,
                        type: ETokenType.class,
                        modifiers: [],
                    },
                    60: {
                        text: "<-",
                        at: 60,
                        type: ETokenType.keyword,
                        modifiers: [],
                    },
                    63: {
                        text: "display w a string",
                        at: 63,
                        type: ETokenType.string,
                        modifiers: [],
                    },
                });
            });

            it("should capture the passage reference for a [[target<-display]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage <- display w a string ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const passageState = { passageTokens: {} };

                uut.parseLinks(passage, header.length, state, passageState);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 15, 2, 29)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });
        });

        describe("Html", () => {
            it("should set an embedded document for an HTML style tag", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    "More content<style>\n" +
                    "  html {\n" +
                    "    margin: 1px;\n" +
                    "  }\n" +
                    "</style> And final content";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });

                uut.parseHtml(passage, header.length, state);
                const [result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql(
                    "\n  html {\n    margin: 1px;\n  }\n"
                );
                expect(result.document.languageId).to.eql("css");
                expect(result.range).to.eql(Range.create(2, 19, 6, 0));
            });

            it("should replace the HTML style section with blanks in the subsection", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    "More content<style>\n" +
                    "  html {\n" +
                    "    margin: 1px;\n" +
                    "  }\n" +
                    "</style> And final content";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });

                const result = uut.parseHtml(passage, header.length, state);

                expect(result).to.eql(
                    "Some content.\n" +
                        "More content        " +
                        "         " +
                        "                 " +
                        "    " +
                        "         And final content"
                );
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

                    uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                    uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                    uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                    uut.parse(doc, callbacks, uut.ParseLevel.Full);

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

                    uut.parse(doc, callbacks, uut.ParseLevel.Full);

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
