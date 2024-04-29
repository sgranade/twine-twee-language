import { expect } from "chai";
import "mocha";
import { DiagnosticSeverity, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Passage, Index } from "../index";

import * as uut from "../indexer";

function buildDocument({
    uri = "fake-uri",
    languageId = "Twine",
    version = 1.0,
    content = "",
}): TextDocument {
    return TextDocument.create(uri, languageId, version, content);
}

function buildPassage({
    name = "Passage",
    location = {
        uri: "fake-uri",
        range: Range.create(1, 1, 2, 2),
    },
    scope = Range.create(3, 3, 4, 4),
    isScript = false,
    isStylesheet = false,
    tags = undefined,
    metadata = undefined,
}): Passage {
    return {
        name: name,
        location: location,
        scope: scope,
        isScript: isScript,
        isStylesheet: isStylesheet,
        tags: tags,
        metadata: metadata,
    };
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

            uut.updateProjectIndex(doc, index);
            const result = index.getPassages("test-uri");

            expect(result).to.eql([
                buildPassage({
                    name: "Passage 1",
                    location: {
                        uri: "test-uri",
                        range: Range.create(0, 0, 0, 11),
                    },
                    scope: Range.create(0, 0, 2, 0),
                }),
                buildPassage({
                    name: "Passage 2",
                    location: {
                        uri: "test-uri",
                        range: Range.create(3, 0, 3, 11),
                    },
                    scope: Range.create(3, 0, 4, 6),
                }),
                buildPassage({
                    name: "Passage 3",
                    location: {
                        uri: "test-uri",
                        range: Range.create(5, 0, 5, 12),
                    },
                    scope: Range.create(5, 0, 5, 12),
                }),
            ]);
        });

        it("should add the story title to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, index);
            const result = index.getStoryTitle();

            expect(result).to.eql("Title!");
        });

        it("should not update the story title when another one comes along", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n\n::StoryTitle\nOther Title!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
            const result = index.getStoryData();

            expect(result).to.eql({
                ifid: "11111111-DEFA-4F70-B7A2-27742230C0FC",
            });
        });

        it("should add parse errors to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Bad Tags [\nContent\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
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

            uut.updateProjectIndex(doc, index);
            uut.updateProjectIndex(doc, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(0);
        });
    });
});
