import { expect } from "chai";
import "mocha";
import * as sinon from "sinon";
import { ImportMock } from "ts-mock-imports";
import * as uuid from "uuid";
import {
    CompletionItem,
    CompletionList,
    Position,
    Range,
    TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../project-index";
import { buildPassage } from "./builders";
import * as ptpModule from "../passage-text-parsers";
import * as embeddedLanguagesModule from "../embedded-languages";

import * as uut from "../completions";
import { generateCompletions } from "../passage-text-parsers/chapbook/chapbook-completions";

describe("Completions", () => {
    describe("Embedded Documents", () => {
        it("should let embedded documents create their own completions", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "0123456789\n123456789\n123456789"
            );
            const position = Position.create(1, 9);
            const index = new Index();
            index.setEmbeddedDocuments("fake-uri", [
                {
                    document: TextDocument.create(
                        "inner-uri",
                        "",
                        0,
                        "embedded doc"
                    ),
                    offset: 17,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                embeddedLanguagesModule,
                "doComplete"
            ).callsFake(
                async (
                    embeddedDoc: embeddedLanguagesModule.EmbeddedDocument
                ) => {
                    if (embeddedDoc.document.uri === "inner-uri") {
                        return CompletionList.create([
                            CompletionItem.create("my completion!"),
                        ]);
                    }
                    return null;
                }
            );

            const result = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );
            mockFunction.restore();

            expect(result?.items).to.eql([{ label: "my completion!" }]);
        });

        it("should adjust embedded document completions' edit range to be relative to the enclosing document", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "0123456789\n123456789\n123456789"
            );
            const position = Position.create(1, 9);
            const index = new Index();
            index.setEmbeddedDocuments("fake-uri", [
                {
                    document: TextDocument.create(
                        "inner-uri",
                        "",
                        0,
                        "embedded doc"
                    ),
                    offset: 17,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                embeddedLanguagesModule,
                "doComplete"
            ).callsFake(
                async (
                    embeddedDoc: embeddedLanguagesModule.EmbeddedDocument
                ) => {
                    if (embeddedDoc.document.uri === "inner-uri") {
                        const item = CompletionItem.create("my completion!");
                        item.textEdit = TextEdit.replace(
                            Range.create(0, 1, 0, 5),
                            "changeit!"
                        );
                        return CompletionList.create([item]);
                    }
                    return null;
                }
            );

            const result = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );
            mockFunction.restore();

            expect(result?.items[0].textEdit).to.eql({
                newText: "changeit!",
                range: Range.create(1, 7, 2, 1),
            });
        });

        describe("StoryData JSON", () => {
            it("should generate and suggest IFID values", async () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "0123456789\n123456789\n123456789\n123456789"
                );
                const position = Position.create(2, 7);
                const index = new Index();
                index.setEmbeddedDocuments("fake-uri", [
                    {
                        document: TextDocument.create(
                            embeddedLanguagesModule.storyDataJSONUri,
                            "",
                            0,
                            '{\n"ifid": ""\n}'
                        ),
                        offset: 17,
                    },
                ]);
                const mockDoComplete = ImportMock.mockFunction(
                    embeddedLanguagesModule,
                    "doComplete"
                ).callsFake(async () => {
                    return null;
                });

                const result = await uut.generateCompletions(
                    doc,
                    position,
                    index,
                    true
                );
                mockDoComplete.restore();

                // Slice the result to remove the quote marks
                expect(
                    uuid.validate(result?.items[0].label.slice(1, -1) || "nope")
                ).to.be.true;
                expect(
                    uuid.version(result?.items[0].label.slice(1, -1) || "nope")
                ).to.equal(4);
            });

            it("should suggest story formats", async () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "0123456789\n123456789\n123456789\n123456789"
                );
                const position = Position.create(2, 9);
                const index = new Index();
                index.setEmbeddedDocuments("fake-uri", [
                    {
                        document: TextDocument.create(
                            embeddedLanguagesModule.storyDataJSONUri,
                            "",
                            0,
                            '{\n"format": ""\n}'
                        ),
                        offset: 17,
                    },
                ]);
                const mockDoComplete = ImportMock.mockFunction(
                    embeddedLanguagesModule,
                    "doComplete"
                ).callsFake(async () => {
                    return null;
                });

                const result = await uut.generateCompletions(
                    doc,
                    position,
                    index,
                    true
                );
                mockDoComplete.restore();

                expect(result?.items.length).to.equal(3);
                expect(result?.items[0].label).to.eql('"Chapbook"');
                expect(result?.items[1].label).to.eql('"Harlowe"');
                expect(result?.items[2].label).to.eql('"SugarCube"');
            });

            it("should suggest passage names for the starting passage", async () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "0123456789\n123456789\n123456789\n123456789"
                );
                const position = Position.create(2, 8);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({ label: "Testy" }),
                ]);
                index.setEmbeddedDocuments("fake-uri", [
                    {
                        document: TextDocument.create(
                            embeddedLanguagesModule.storyDataJSONUri,
                            "",
                            0,
                            '{\n"start": ""\n}'
                        ),
                        offset: 17,
                    },
                ]);
                const mockDoComplete = ImportMock.mockFunction(
                    embeddedLanguagesModule,
                    "doComplete"
                ).callsFake(async () => {
                    return null;
                });

                const result = await uut.generateCompletions(
                    doc,
                    position,
                    index,
                    true
                );
                mockDoComplete.restore();

                expect(result?.items.length).to.equal(1);
                expect(result?.items[0].label).to.eql('"Testy"');
            });

            it("should suggest color names for tag-colors", async () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "0123456789\n123456789\n12345678901234567890123456789\n123456789"
                );
                const position = Position.create(2, 23);
                const index = new Index();
                index.setEmbeddedDocuments("fake-uri", [
                    {
                        document: TextDocument.create(
                            embeddedLanguagesModule.storyDataJSONUri,
                            "",
                            0,
                            '{\n"tag-colors": { "test": "" }\n}'
                        ),
                        offset: 17,
                    },
                ]);
                const mockDoComplete = ImportMock.mockFunction(
                    embeddedLanguagesModule,
                    "doComplete"
                ).callsFake(async () => {
                    return null;
                });

                const result = await uut.generateCompletions(
                    doc,
                    position,
                    index,
                    true
                );
                mockDoComplete.restore();

                expect(result?.items.length).to.equal(7);
                expect(result?.items[0].label).to.eql('"gray"');
                expect(result?.items[1].label).to.eql('"red"');
                expect(result?.items[2].label).to.eql('"orange"');
                expect(result?.items[3].label).to.eql('"yellow"');
                expect(result?.items[4].label).to.eql('"green"');
                expect(result?.items[5].label).to.eql('"blue"');
                expect(result?.items[6].label).to.eql('"purple"');
            });
        });
    });

    describe("Links", () => {
        it("should suggest a passage just after a [[", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ ");
            const position = Position.create(0, 4);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 3, 0, 4)
            );
        });

        it("should suggest a passage just after a [[ (without item defaults)", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ ");
            const position = Position.create(0, 4);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                false // Return without CompletionList.itemDefaults
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 3, 0, 4),
                newText: "Testy",
            });
        });

        it("should suggest a replacement passage just after a [[", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 3, 0, 9)
            );
        });

        it("should not suggest a passage within a [[ ... |", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe |");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results).to.be.null;
        });

        it("should suggest a replacement passage just after a [[...|", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe | other passage \nother"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 11, 0, 26)
            );
        });

        it("should not suggest a passage within a [[ ... ->", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe ->");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results).to.be.null;
        });

        it("should suggest a replacement passage just after a [[...->", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe -> other passage \nother"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 12, 0, 27)
            );
        });

        it("should suggest a passage replacement within the limits of [[ ... ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ replace all of this ]] but not this"
            );
            const position = Position.create(0, 4);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 3, 0, 24)
            );
        });

        it("should suggest a replacement passage within [[...| here ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe | replace this ]] but not this"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 11, 0, 25)
            );
        });

        it("should suggest a replacement passage within [[...-> here ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe -> other passage ]] not here"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("Testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(0, 12, 0, 27)
            );
        });
    });

    describe("Story Formats", () => {
        it("should call story formats' generateCompletions method", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, "words");
            const position = Position.create(0, 4);
            const index = new Index();
            index.setStoryData(
                {
                    ifid: "mock-ifid",
                    storyFormat: { format: "FakeFormat" },
                },
                "fake-uri"
            );
            const completionList = CompletionList.create([
                { label: "story completion" },
            ]);
            const mockFunction = ImportMock.mockFunction(
                ptpModule,
                "getStoryFormatParser"
            ).callsFake(() => {
                return {
                    id: "FakeFormat",
                    generateCompletions: () => completionList,
                };
            });

            const result = await uut.generateCompletions(
                doc,
                position,
                index,
                true
            );
            mockFunction.restore();

            expect(result).to.eql(completionList);
        });
    });
});
