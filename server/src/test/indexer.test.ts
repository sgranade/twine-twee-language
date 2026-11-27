import { expect } from "chai";
import "mocha";
import {
    DiagnosticSeverity,
    Location,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DecorationType, DiagnosticCodes } from "@tt3/shared";
import { getDefinitionAt } from "../definition";
import { ParseLevel } from "../parser-types";
import { getReferencesToSymbolAt } from "../references";
import { ParsingState } from "../passage-text-parsers/types";
import { conditionalReferenceQualifier } from "../passage-text-parsers/chapbook/chapbook-references";
import { OChapbookSymbolKind } from "../passage-text-parsers/chapbook/types";
import { OSugarCubeSymbolKind } from "../passage-text-parsers/sugarcube/types";
import { Index } from "../project-index";
import { buildPassage } from "./builders";
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
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

        it("should add definitions to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();

            // Because definitions only show up in passage contents, we
            // need to mock the passage text parser to create a reference
            uut.updateProjectIndex(doc, ParseLevel.Full, index, () => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState,
                    ) => {
                        if (passageText === "Yup\n\n")
                            state.callbacks.onSymbolDefinition({
                                contents: "symbol",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(1, 2, 3, 4),
                                ),
                                kind: 17,
                            });
                    },
                    generateCompletions: () => null,
                    generateDiagnostics: () => [],
                    generateHover: () => null,
                    generateRenamesAt: () => undefined,
                    getDefinitionAt: () => undefined,
                    getReferencesToSymbolAt: () => undefined,
                };
            });
            const result = index.getDefinitions("test-uri", 17);

            expect(result).to.eql([
                {
                    contents: "symbol",
                    location: Location.create(
                        "test-uri",
                        Range.create(1, 2, 3, 4),
                    ),
                    kind: 17,
                },
            ]);
        });

        it("should add references to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();

            // Because passage references only show up in passage contents, we
            // need to mock the passage text parser to create a reference
            uut.updateProjectIndex(doc, ParseLevel.Full, index, () => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState,
                    ) => {
                        if (passageText === "Yup\n\n")
                            state.callbacks.onSymbolReference({
                                contents: "Other Passage",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(1, 2, 3, 4),
                                ),
                                kind: 1,
                            });
                    },
                    generateCompletions: () => null,
                    generateDiagnostics: () => [],
                    generateHover: () => null,
                    generateRenamesAt: () => undefined,
                    getDefinitionAt: () => undefined,
                    getReferencesToSymbolAt: () => undefined,
                };
            });
            const result = index.getReferences("test-uri", 1);

            expect(result).to.eql([
                {
                    contents: "Other Passage",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 1,
                },
            ]);
        });

        it("should add references with different kinds but the same name to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();

            // Because passage references only show up in passage contents, we
            // need to mock the passage text parser to create a reference
            uut.updateProjectIndex(doc, ParseLevel.Full, index, () => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState,
                    ) => {
                        if (passageText === "Yup\n\n") {
                            state.callbacks.onSymbolReference({
                                contents: "passage",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(1, 2, 3, 4),
                                ),
                                kind: 1,
                            });
                            state.callbacks.onSymbolReference({
                                contents: "passage",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(1, 2, 3, 4),
                                ),
                                kind: 2,
                            });
                        }
                    },
                    generateCompletions: () => null,
                    generateDiagnostics: () => [],
                    generateHover: () => null,
                    generateRenamesAt: () => undefined,
                    getDefinitionAt: () => undefined,
                    getReferencesToSymbolAt: () => undefined,
                };
            });
            const result_0 = index.getReferences("test-uri", 1);
            const result_1 = index.getReferences("test-uri", 2);

            expect(result_0).to.eql([
                {
                    contents: "passage",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 1,
                },
            ]);
            expect(result_1).to.eql([
                {
                    contents: "passage",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 2,
                },
            ]);
        });

        it("should group references whose shape sources differ only in order and duplicates", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index, () => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState,
                    ) => {
                        if (passageText === "Yup\n\n") {
                            state.callbacks.onSymbolReference({
                                contents: "$p",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(1, 2, 3, 4),
                                ),
                                kind: 1,
                                shapeSources: ["$b", "$a"],
                            });
                            state.callbacks.onSymbolReference({
                                contents: "$p",
                                location: Location.create(
                                    "test-uri",
                                    Range.create(5, 6, 7, 8),
                                ),
                                kind: 1,
                                shapeSources: ["$a", "$b", "$a"],
                            });
                        }
                    },
                    generateCompletions: () => null,
                    generateDiagnostics: () => [],
                    generateHover: () => null,
                    generateRenamesAt: () => undefined,
                    getDefinitionAt: () => undefined,
                    getReferencesToSymbolAt: () => undefined,
                };
            });
            const result = index.getReferences("test-uri", 1);

            expect(result).to.eql([
                {
                    contents: "$p",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                        Location.create("test-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: 1,
                    shapeSources: ["$a", "$b"],
                },
            ]);
        });

        it("should add the story title to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getStoryTitle();

            expect(result).to.eql("Title!");
        });

        it("should not update the story title when another one comes along", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nTitle!\n\n::StoryTitle\nOther Title!\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const [result] = [...index.getEmbeddedDocuments("test-uri")];

            expect(result.document.getText()).to.eql(
                '{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n',
            );
            expect(result.document.languageId).to.eql("json");
            expect(result.range).to.eql(Range.create(1, 0, 2, 0));
        });

        it("should add folding ranges to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n::Passage 2\nYupyup",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getFoldingRanges("test-uri");

            expect(result).to.eql([
                Range.create(0, 0, 2, 0),
                Range.create(3, 0, 4, 6),
            ]);
        });

        it("should add decoration ranges to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Passage 1\nYup\n\n",
            });
            const index = new Index();

            // Because decoration ranges only show up in passage contents, we
            // need to mock the passage text parser to create a reference
            uut.updateProjectIndex(doc, ParseLevel.Full, index, () => {
                return {
                    id: "FakeFormat",
                    parsePassageText: (
                        passageText: string,
                        textIndex: number,
                        state: ParsingState,
                    ) => {
                        if (passageText === "Yup\n\n")
                            state.callbacks.onDecorationRange({
                                type: DecorationType.ChapbookModifierContent,
                                range: Range.create(1, 2, 3, 4),
                            });
                    },
                    generateCompletions: () => null,
                    generateDiagnostics: () => [],
                    generateHover: () => null,
                    generateRenamesAt: () => undefined,
                    getDefinitionAt: () => undefined,
                    getReferencesToSymbolAt: () => undefined,
                };
            });
            const result = index.getDecorationRanges("test-uri");

            expect(result).to.eql([
                {
                    type: DecorationType.ChapbookModifierContent,
                    range: Range.create(1, 2, 3, 4),
                },
            ]);
        });

        it("should add parse errors to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Bad Tags [\nContent\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].message).to.include(
                "Tags aren't formatted correctly",
            );
        });

        it("should add disabled diagnostic ranges to the index", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::Disabled [tt3-disable missing-passage]\nContent",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.diagnosticIsDisabled(
                "test-uri",
                DiagnosticCodes.MissingPassage,
                Range.create(1, 2, 1, 4),
            );

            expect(result).to.be.true;
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].severity).to.eql(DiagnosticSeverity.Warning);
            expect(result[0].range.start).to.eql(Position.create(4, 0));
            expect(result[0].range.end).to.eql(Position.create(4, 9));
            expect(result[0].message).to.include(
                "This replaces an existing StoryTitle; is that intentional?",
            );
        });

        it("should not warn about changing StoryTitle when re-parsing", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content: "::StoryTitle\nOriginal title\n",
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            uut.updateProjectIndex(doc, ParseLevel.Full, index);
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

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(1);
            expect(result[0].severity).to.eql(DiagnosticSeverity.Warning);
            expect(result[0].range.start).to.eql(Position.create(4, 0));
            expect(result[0].range.end).to.eql(Position.create(4, 50));
            expect(result[0].message).to.include(
                "This replaces existing StoryData; is that intentional?",
            );
        });

        it("should not warn about updating StoryData when re-parsing", () => {
            const doc = buildDocument({
                uri: "test-uri",
                content:
                    '::StoryData\n{ "ifid": "11111111-DEFA-4F70-B7A2-27742230C0FC" }\n',
            });
            const index = new Index();

            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            uut.updateProjectIndex(doc, ParseLevel.Full, index);
            const result = index.getParseErrors("test-uri");

            expect(result.length).to.equal(0);
        });
    });

    describe("Script File Indexing", () => {
        function indexWithFormat(format: string, version: string): Index {
            const index = new Index();
            index.setStoryData(
                {
                    ifid: "x",
                    storyFormat: { format, formatVersion: version },
                },
                "story-data-uri",
            );
            return index;
        }
        function names(index: Index, uri: string, kind: number): string[] {
            return (index.getReferences(uri, kind) ?? []).map(
                (r) => r.contents,
            );
        }

        it("should index SugarCube State.variables writes at their real offsets without adding passages", () => {
            const index = indexWithFormat("SugarCube", "2.36.1");
            const doc = buildDocument({
                uri: "file:///s.js",
                content: "State.variables.gold = 1;",
            });

            uut.updateScriptFileIndex(
                doc,
                "story-script",
                ParseLevel.Full,
                index,
            );
            const sets = index.getReferences(
                "file:///s.js",
                OSugarCubeSymbolKind.VariableSet,
            );

            expect(sets?.map((r) => r.contents)).to.eql(["$gold"]);
            expect(sets?.[0].locations[0].range).to.eql(
                Range.create(0, 16, 0, 20),
            );
            expect(index.getPassages("file:///s.js") ?? []).to.be.empty;
            expect(index.getScriptFileRole("file:///s.js")).to.equal(
                "story-script",
            );
        });

        it("should index Chapbook engine.state.set writes", () => {
            const index = indexWithFormat("Chapbook", "2.3.0");
            const doc = buildDocument({
                uri: "file:///i.js",
                content: "engine.state.set('gold', 1);",
            });

            uut.updateScriptFileIndex(
                doc,
                "included-script",
                ParseLevel.Full,
                index,
            );

            expect(
                names(index, "file:///i.js", OChapbookSymbolKind.VariableSet),
            ).to.eql(["gold"]);
        });

        it("should extract nothing when the story format is unknown", () => {
            const index = new Index();
            const doc = buildDocument({
                uri: "file:///s.js",
                content: "State.variables.gold = 1;",
            });

            uut.updateScriptFileIndex(
                doc,
                "story-script",
                ParseLevel.Full,
                index,
            );

            expect(
                index.getReferences(
                    "file:///s.js",
                    OSugarCubeSymbolKind.VariableSet,
                ),
            ).to.be.undefined;
        });

        it("should do nothing below the full parse level", () => {
            const index = indexWithFormat("SugarCube", "2.36.1");
            const doc = buildDocument({
                uri: "file:///s.js",
                content: "State.variables.gold = 1;",
            });

            uut.updateScriptFileIndex(
                doc,
                "story-script",
                ParseLevel.PassageNames,
                index,
            );

            expect(
                index.getReferences(
                    "file:///s.js",
                    OSugarCubeSymbolKind.VariableSet,
                ),
            ).to.be.undefined;
        });

        it("should not index a bare name declared in its own file", () => {
            const index = indexWithFormat("Chapbook", "2.3.0");
            const doc = buildDocument({
                uri: "file:///inc.js",
                content: "let gold = 1; gold; function f() { return other; }",
            });

            uut.updateScriptFileIndex(
                doc,
                "included-script",
                ParseLevel.Full,
                index,
            );

            expect(
                names(
                    index,
                    "file:///inc.js",
                    OChapbookSymbolKind.ConditionalReference,
                ),
            ).to.eql(["other"]);
        });

        it("should not let included scripts' root declarations (or declarations elsewhere) hide their bare names", () => {
            const index = indexWithFormat("Chapbook", "2.3.0");
            const set = buildDocument({
                uri: "file:///set.js",
                content: "engine.state.set('gold', 1);",
            });
            const declares = buildDocument({
                uri: "file:///declares.js",
                content: "var gold = 2;",
            });
            const included = buildDocument({
                uri: "file:///inc.js",
                content: "var gold = 3; var other = 1;",
            });
            const story = buildDocument({
                uri: "file:///story.js",
                content: "gold;",
            });
            const bareIncluded = buildDocument({
                uri: "file:///bare.js",
                content: "gold;",
            });
            uut.updateScriptFileIndex(
                set,
                "story-script",
                ParseLevel.Full,
                index,
            );
            uut.updateScriptFileIndex(
                included,
                "included-script",
                ParseLevel.Full,
                index,
            );
            uut.updateScriptFileIndex(
                story,
                "story-script",
                ParseLevel.Full,
                index,
            );
            uut.updateScriptFileIndex(
                bareIncluded,
                "included-script",
                ParseLevel.Full,
                index,
            );

            const qualifies = conditionalReferenceQualifier(index);
            // The included script's own declaration doesn't count
            expect(qualifies("gold", "file:///story.js")).to.be.true;

            uut.updateScriptFileIndex(
                declares,
                "story-script",
                ParseLevel.Full,
                index,
            );
            const qualifiesNow = conditionalReferenceQualifier(index);
            expect(qualifiesNow("gold", "file:///story.js")).to.be.false;
            expect(qualifiesNow("gold", "file:///bare.js")).to.be.true;
        });

        it("should not go to a story variable's assignments from a bare name that's bound by a root declaration", () => {
            const index = indexWithFormat("Chapbook", "2.3.0");
            for (const [uri, content] of [
                ["file:///set.js", "engine.state.set('gold', 1);"],
                ["file:///declares.js", "var gold = 2;"],
                ["file:///story.js", "gold;"],
            ]) {
                uut.updateScriptFileIndex(
                    buildDocument({ uri, content }),
                    "story-script",
                    ParseLevel.Full,
                    index,
                );
            }

            const result = getDefinitionAt(
                buildDocument({ uri: "file:///story.js", content: "gold;" }),
                Position.create(0, 1),
                index,
            );

            expect(result).to.be.undefined;
        });

        describe("Indexing From a Twee File", () => {
            function indexSugarCubeProject(): Index {
                const index = new Index();
                uut.updateProjectIndex(
                    buildDocument({
                        uri: "file:///story.tw",
                        content:
                            ':: StoryData\n{"ifid": "x", "format": "SugarCube", "format-version": "2.36.1"}\n\n:: Start\nYou have $gold coins.\n',
                    }),
                    ParseLevel.Full,
                    index,
                );
                uut.updateScriptFileIndex(
                    buildDocument({
                        uri: "file:///s.js",
                        content: "State.variables.gold = 1;",
                    }),
                    "story-script",
                    ParseLevel.Full,
                    index,
                );
                uut.updateScriptFileIndex(
                    buildDocument({
                        uri: "file:///i.js",
                        content: "\nState.variables.gold = 2;",
                    }),
                    "included-script",
                    ParseLevel.Full,
                    index,
                );
                return index;
            }

            it("should find references in story script files and included scripts", () => {
                const index = indexSugarCubeProject();

                const result = getReferencesToSymbolAt(
                    "file:///story.tw",
                    Position.create(4, 11),
                    index,
                    true,
                );

                expect(result).to.have.deep.members([
                    Location.create(
                        "file:///story.tw",
                        Range.create(4, 9, 4, 14),
                    ),
                    Location.create("file:///s.js", Range.create(0, 16, 0, 20)),
                    Location.create("file:///i.js", Range.create(1, 16, 1, 20)),
                ]);
            });

            it("should go to an assignment in a script file", () => {
                const index = indexSugarCubeProject();
                const story = buildDocument({
                    uri: "file:///story.tw",
                    content: "",
                });

                const result = getDefinitionAt(
                    story,
                    Position.create(4, 11),
                    index,
                );

                expect(result).to.deep.include(
                    Location.create("file:///s.js", Range.create(0, 16, 0, 20)),
                );
            });

            it("should go to a Chapbook assignment in a script file", () => {
                const index = new Index();
                uut.updateProjectIndex(
                    buildDocument({
                        uri: "file:///story.tw",
                        content:
                            ':: StoryData\n{"ifid": "x", "format": "Chapbook", "format-version": "2.3.0"}\n\n:: Start\nYou have {gold} coins.\n',
                    }),
                    ParseLevel.Full,
                    index,
                );
                uut.updateScriptFileIndex(
                    buildDocument({
                        uri: "file:///s.js",
                        content: "engine.state.set('gold', 1);",
                    }),
                    "story-script",
                    ParseLevel.Full,
                    index,
                );
                const story = buildDocument({
                    uri: "file:///story.tw",
                    content: "",
                });

                const result = getDefinitionAt(
                    story,
                    Position.create(4, 11),
                    index,
                );

                expect(result).to.eql([
                    Location.create("file:///s.js", Range.create(0, 18, 0, 22)),
                ]);
            });

            it("should go to every place a story variable is assigned to, including Twee files", () => {
                const index = indexSugarCubeProject();
                uut.updateProjectIndex(
                    buildDocument({
                        uri: "file:///set.tw",
                        content: ":: Setup\n<<set $gold to 5>>\n",
                    }),
                    ParseLevel.Full,
                    index,
                );
                const story = buildDocument({
                    uri: "file:///story.tw",
                    content: "",
                });

                const result = getDefinitionAt(
                    story,
                    Position.create(4, 11),
                    index,
                );

                expect(result).to.have.deep.members([
                    Location.create(
                        "file:///set.tw",
                        Range.create(1, 6, 1, 11),
                    ),
                    Location.create("file:///s.js", Range.create(0, 16, 0, 20)),
                    Location.create("file:///i.js", Range.create(1, 16, 1, 20)),
                ]);
            });
        });
    });
});
