import { expect } from "chai";
import "mocha";
import { ImportMock } from "ts-mock-imports";
import { DiagnosticSeverity, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../project-index";
import { buildPassage } from "./builders";

import * as ptpModule from "../passage-text-parsers";
import { ParsingState } from "../parser";
import * as uut from "../indexer";

function buildDocument({
    uri = "fake-uri",
    languageId = "Twine",
    version = 1.0,
    content = "",
}): TextDocument {
    return TextDocument.create(uri, languageId, version, content);
}

describe("Indexer", () => {
    describe("Index Updating", () => {
        it("should add passages to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    "::Passage 1\nYup\n\n::Passage 2\nYupyup\n:: Passage 3",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getPassages("test-uri");

            expect(result).to.eql([
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "test-uri",
                        range: Range.create(0, 2, 0, 11),
                    },
                    scope: Range.create(0, 0, 2, 0),
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "test-uri",
                        range: Range.create(3, 2, 3, 11),
                    },
                    scope: Range.create(3, 0, 4, 6),
                }),
                buildPassage({
                    label: "Passage 3",
                    location: {
                        uri: "test-uri",
                        range: Range.create(5, 3, 5, 12),
                    },
                    scope: Range.create(5, 0, 5, 12),
                }),
            ]);
        });

        it("should add passage references to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();
            // Because passage references only show up in passage contents, we
            // need to mock the passage text parser to create a reference
            const mockFunction = ImportMock.mockFunction(
                ptpModule,
                "getPassageTextParser"
            ).callsFake(() => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState
                    ) => {
                        if (passageText === "Yup\n\n")
                            state.callbacks.onPassageReference(
                                "Other Passage",
                                Range.create(1, 2, 3, 4)
                            );
                    },
                };
            });

            uut.updateProjectIndex(doc, true, index);
            mockFunction.restore();
            const result = index.getPassageReferences("test-uri");

            expect(result).to.eql({
                "Other Passage": [Range.create(1, 2, 3, 4)],
            });
        });

        it("should add the story title to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getStoryTitle();

            expect(result).to.eql("Title!");
        });

        it("should not update the story title when another one comes along", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n\n::StoryTitle\nOther Title!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getStoryTitle();

            expect(result).to.equal("Title!");
        });

        it("should add the story data to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getStoryData();

            expect(result).to.eql({
                ifid: "11111111-DEFA-4F70-B7A2-27742230C0FC",
            });
        });

        it("should not update the story data when another one comes along", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n\n' +
                    '::StoryData\n{ "ifid": "22222222-DEFA-4F70-B7A2-27742230C0FC" }\n\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getStoryData();

            expect(result).to.eql({
                ifid: "11111111-DEFA-4F70-B7A2-27742230C0FC",
            });
        });

        it("should add an embedded document to the index for story data", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const [result] = [...index.getEmbeddedDocuments("test-uri")];

            expect(result.document.getText()).to.eql(
                '{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n'
            );
            expect(result.document.languageId).to.eql("json");
            expect(result.offset).to.eql(12);
        });

        it("should add parse errors to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Bad Tags [\nContent\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].message).to.include(
                "Tags aren't formatted correctly"
            );
        });
    });

    describe("Parse Errors", () => {
        it("should warn if StoryTitle is changed", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    "::StoryTitle\nOriginal title\n\n::StoryTitle\nNew title\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].severity).to.eql(DiagnosticSeverity.Warning);
            expect(result[0].range.start).to.eql(Position.create(4, 0));
            expect(result[0].range.end).to.eql(Position.create(4, 9));
            expect(result[0].message).to.include(
                "This replaces an existing StoryTitle. Is that intentional?"
            );
        });

        it("should not warn about changing StoryTitle when re-parsing", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nOriginal title\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            uut.updateProjectIndex(doc, true, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(0);
        });

        it("should warn if StoryData is changed", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n\n::StoryData\n{ "ifid": "22222222-DEFA-4F70-B7A2-27742230C0FC" }\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].severity).to.eql(DiagnosticSeverity.Warning);
            expect(result[0].range.start).to.eql(Position.create(4, 0));
            expect(result[0].range.end).to.eql(Position.create(4, 50));
            expect(result[0].message).to.include(
                "This replaces existing StoryData. Is that intentional?"
            );
        });

        it("should not warn about updating StoryData when re-parsing", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, true, index);
            uut.updateProjectIndex(doc, true, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(0);
        });
    });
});
