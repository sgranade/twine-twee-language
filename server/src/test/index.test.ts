import { expect } from "chai";
import "mocha";
import { Diagnostic, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildPassage } from "./builders";

import { EmbeddedDocument } from "../embedded-languages";
import * as uut from "../index";
import { Token } from "../tokens";

describe("Project Index", () => {
    describe("Index", () => {
        describe("Story Title", () => {
            it("should return undefined if no story title has been set", () => {
                const index = new uut.Index();

                const result = index.getStoryTitle();

                expect(result).to.be.undefined;
            });

            it("should set the story title", () => {
                const index = new uut.Index();
                index.setStoryTitle("Title!", "fake-uri");

                const result = index.getStoryTitle();

                expect(result).to.equal("Title!");
            });

            it("should set the story title's URI", () => {
                const index = new uut.Index();
                index.setStoryTitle("Title!", "fake-uri");

                const result = index.getStoryTitleUri();

                expect(result).to.equal("fake-uri");
            });
        });

        describe("Story Data", () => {
            it("should return undefined if no story data has been set", () => {
                const index = new uut.Index();

                const result = index.getStoryData();

                expect(result).to.be.undefined;
            });

            it("should set the story data", () => {
                const index = new uut.Index();
                index.setStoryData(
                    {
                        ifid: "fake-ifid",
                        storyFormat: {
                            format: "Fake Format",
                        },
                    },
                    "fake-uri"
                );

                const result = index.getStoryData();

                expect(result).to.eql({
                    ifid: "fake-ifid",
                    storyFormat: {
                        format: "Fake Format",
                    },
                });
            });

            it("should set the story data's URI", () => {
                const index = new uut.Index();
                index.setStoryData(
                    {
                        ifid: "fake-ifid",
                    },
                    "fake-uri"
                );

                const result = index.getStoryDataUri();

                expect(result).to.equal("fake-uri");
            });
        });

        describe("Passages", () => {
            it("should return undefined for unindexed files", () => {
                const index = new uut.Index();

                const result = index.getPassages("nopers");

                expect(result).to.be.undefined;
            });

            it("should return passages for indexed files", () => {
                const passages = [
                    buildPassage({ label: "Passage 1" }),
                    buildPassage({ label: "Passage 2" }),
                ];
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);

                const result = index.getPassages("fake-uri");

                expect(result).to.eql(passages);
            });
        });

        describe("Embedded Documents", () => {
            it("should return an empty array for an unindexed file", () => {
                const index = new uut.Index();

                const result = index.getEmbeddedDocuments("nopers");

                expect(result).to.be.empty;
            });

            it("should return embedded documents for indexed files", () => {
                const fakeEmbeddedDoc = TextDocument.create(
                    "fake-sub-ui",
                    "json",
                    1,
                    '{ "prop": 7 }'
                );
                const docs: EmbeddedDocument[] = [
                    {
                        document: fakeEmbeddedDoc,
                        offset: 7,
                        languageId: "json",
                    },
                ];
                const index = new uut.Index();
                index.setEmbeddedDocuments("fake-uri", docs);

                const result = index.getEmbeddedDocuments("fake-uri");

                expect(result).to.eql(docs);
            });
        });

        describe("Tokens", () => {
            it("should return an empty array for an unindexed file", () => {
                const index = new uut.Index();

                const result = index.getTokens("nopers");

                expect(result).to.be.empty;
            });

            it("should return tokens for indexed files", () => {
                const fakeTokens: Token[] = [
                    {
                        line: 1,
                        char: 2,
                        length: 3,
                        tokenModifiers: 1,
                        tokenType: 2,
                    },
                ];
                const index = new uut.Index();
                index.setTokens("fake-uri", fakeTokens);

                const result = index.getTokens("fake-uri");

                expect(result).to.eql(fakeTokens);
            });
        });

        describe("Parse Errors", () => {
            it("should return an empty array for missing files", () => {
                const index = new uut.Index();

                const result = index.getParseErrors("nopers");

                expect(result).to.be.empty;
            });

            it("should return errors for indexed files", () => {
                const errors = [
                    Diagnostic.create(Range.create(1, 1, 2, 2), "Problem 1"),
                    Diagnostic.create(
                        Range.create(3, 3, 4, 4),
                        "Another problem"
                    ),
                ];
                const index = new uut.Index();
                index.setParseErrors("fake-uri", errors);

                const result = index.getParseErrors("fake-uri");

                expect(result).to.eql(errors);
            });
        });

        describe("Passage Names", () => {
            it("should return passage names across all indexed files", () => {
                const passages1 = [
                    buildPassage({ label: "F1 P1" }),
                    buildPassage({ label: "F1 P2" }),
                ];
                const passages2 = [
                    buildPassage({ label: "F2 P1" }),
                    buildPassage({ label: "F2 P2" }),
                ];
                const index = new uut.Index();
                index.setPassages("file1", passages1);
                index.setPassages("file2", passages2);

                const result = index.getPassageNames();

                expect(result).to.eql(["F1 P1", "F1 P2", "F2 P1", "F2 P2"]);
            });

            it("should return passage names with no duplicates", () => {
                const passages1 = [
                    buildPassage({ label: "F1 P1" }),
                    buildPassage({ label: "spoiler" }),
                ];
                const passages2 = [
                    buildPassage({ label: "spoiler" }),
                    buildPassage({ label: "F2 P2" }),
                ];
                const index = new uut.Index();
                index.setPassages("file1", passages1);
                index.setPassages("file2", passages2);

                const result = index.getPassageNames();

                expect(result).to.eql(["F1 P1", "spoiler", "F2 P2"]);
            });
        });

        describe("Removing Documents", () => {
            it("should remove the story title if a deleted document contained it", () => {
                const index = new uut.Index();
                index.setStoryTitle("Title!", "storytitle-uri");

                index.removeDocument("storytitle-uri");
                const result = index.getStoryTitle();

                expect(result).to.be.undefined;
            });

            it("should leave the story title alone if a deleted document didn't contain it", () => {
                const index = new uut.Index();
                index.setStoryTitle("Title!", "storytitle-uri");

                index.removeDocument("other-uri");
                const result = index.getStoryTitle();

                expect(result).to.equal("Title!");
            });

            it("should remove story data if a deleted document contained it", () => {
                const index = new uut.Index();
                index.setStoryData(
                    {
                        ifid: "fake-ifid",
                    },
                    "storydata-uri"
                );

                index.removeDocument("storydata-uri");
                const result = index.getStoryData();

                expect(result).to.be.undefined;
            });

            it("should leave story data alone if a deleted document didn't contain it", () => {
                const index = new uut.Index();
                index.setStoryData(
                    {
                        ifid: "fake-ifid",
                    },
                    "storydata-uri"
                );

                index.removeDocument("other-uri");
                const result = index.getStoryData();

                expect(result).not.to.be.undefined;
            });

            it("should remove passages from a deleted document", () => {
                const passages1 = [
                    buildPassage({ label: "F1 P1" }),
                    buildPassage({ label: "F1 P2" }),
                ];
                const passages2 = [
                    buildPassage({ label: "F2 P1" }),
                    buildPassage({ label: "F2 P2" }),
                ];
                const index = new uut.Index();
                index.setPassages("file1", passages1);
                index.setPassages("file2", passages2);

                index.removeDocument("file1");
                const result = index.getPassageNames();

                expect(result).to.eql(["F2 P1", "F2 P2"]);
            });

            it("should remove embedded documents for a deleted document", () => {
                const fakeEmbeddedDoc = TextDocument.create(
                    "fake-sub-ui",
                    "json",
                    1,
                    '{ "prop": 7 }'
                );
                const docs: EmbeddedDocument[] = [
                    {
                        document: fakeEmbeddedDoc,
                        offset: 7,
                        languageId: "json",
                    },
                ];
                const index = new uut.Index();
                index.setEmbeddedDocuments("fake-uri", docs);

                index.removeDocument("fake-uri");
                const result = index.getEmbeddedDocuments("fake-uri");

                expect(result).to.be.empty;
            });

            it("should remove tokens for a deleted document", () => {
                const fakeTokens: Token[] = [
                    {
                        line: 1,
                        char: 2,
                        length: 3,
                        tokenModifiers: 1,
                        tokenType: 2,
                    },
                ];
                const index = new uut.Index();
                index.setTokens("fake-uri", fakeTokens);

                index.removeDocument("fake-uri");
                const result = index.getTokens("fake-uri");

                expect(result).to.be.empty;
            });

            it("should remove parse errors for a deleted document", () => {
                const errors = [
                    Diagnostic.create(Range.create(1, 1, 2, 2), "Problem 1"),
                    Diagnostic.create(
                        Range.create(3, 3, 4, 4),
                        "Another problem"
                    ),
                ];
                const index = new uut.Index();
                index.setParseErrors("storytitle-uri", errors);

                index.removeDocument("storytitle-uri");
                const result = index.getParseErrors("storytitle-uri");

                expect(result).to.be.empty;
            });

            it("should leave parse errors alone for a not-deleted document", () => {
                const errors = [
                    Diagnostic.create(Range.create(1, 1, 2, 2), "Problem 1"),
                    Diagnostic.create(
                        Range.create(3, 3, 4, 4),
                        "Another problem"
                    ),
                ];
                const index = new uut.Index();
                index.setParseErrors("storytitle-uri", errors);

                index.removeDocument("other-uri");
                const result = index.getParseErrors("storytitle-uri");

                expect(result).to.eql(errors);
            });
        });
    });
});
