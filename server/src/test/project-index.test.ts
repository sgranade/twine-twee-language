import { expect } from "chai";
import "mocha";
import { Diagnostic, Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildPassage } from "./builders";

import { EmbeddedDocument } from "../embedded-languages";
import * as uut from "../project-index";
import { SemanticToken } from "../semantic-tokens";

describe("Project Index", () => {
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

    describe("Definitions", () => {
        it("should return undefined for unindexed files", () => {
            const index = new uut.Index();

            const result = index.getDefinitions("nopers", 1);

            expect(result).to.be.undefined;
        });

        it("should return definitions for indexed files", () => {
            const definitions = [
                {
                    contents: "one",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 1,
                },
                {
                    contents: "two",
                    location: Location.create(
                        "fake-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: 2,
                },
            ];
            const index = new uut.Index();
            index.setDefinitions("fake-uri", definitions);

            const result = index.getDefinitions("fake-uri", 1);

            expect(result).to.eql([
                {
                    contents: "one",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 1,
                },
            ]);
        });
    });

    describe("References", () => {
        it("should return undefined for unindexed files", () => {
            const index = new uut.Index();

            const result = index.getReferences("nopers", 1);

            expect(result).to.be.undefined;
        });

        it("should return references for indexed files", () => {
            const references = [
                {
                    contents: "one",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 1,
                },
                {
                    contents: "two",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: 2,
                },
            ];
            const index = new uut.Index();
            index.setReferences("fake-uri", references);

            const result = index.getReferences("fake-uri", 1);

            expect(result).to.eql([
                {
                    contents: "one",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 1,
                },
            ]);
        });
    });

    describe("Embedded Documents", () => {
        it("should return an empty array for an unindexed file", () => {
            const index = new uut.Index();

            const result = index.getEmbeddedDocuments("nopers");

            expect(result).to.be.empty;
        });

        it("should return embedded documents for indexed files", () => {
            const docs: EmbeddedDocument[] = [
                EmbeddedDocument.create(
                    "fake-sub-uri",
                    "json",
                    '{ "prop": 7 }',
                    7,
                    TextDocument.create("fake-uri", "", 2, "fake-content")
                ),
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

            const result = index.getSemanticTokens("nopers");

            expect(result).to.be.empty;
        });

        it("should return tokens for indexed files", () => {
            const fakeTokens: SemanticToken[] = [
                {
                    line: 1,
                    char: 2,
                    length: 3,
                    tokenModifiers: [1],
                    tokenType: 2,
                },
            ];
            const index = new uut.Index();
            index.setSemanticTokens("fake-uri", fakeTokens);

            const result = index.getSemanticTokens("fake-uri");

            expect(result).to.eql(fakeTokens);
        });
    });

    describe("Folding Ranges", () => {
        it("should return an empty array for an unindexed file", () => {
            const index = new uut.Index();

            const result = index.getFoldingRanges("nopers");

            expect(result).to.be.empty;
        });

        it("should return ranges for indexed files", () => {
            const fakeRanges = [
                Range.create(1, 2, 3, 4),
                Range.create(5, 6, 7, 8),
            ];
            const index = new uut.Index();
            index.setFoldingRanges("fake-uri", fakeRanges);

            const result = index.getFoldingRanges("fake-uri");

            expect(result).to.eql(fakeRanges);
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
                Diagnostic.create(Range.create(3, 3, 4, 4), "Another problem"),
            ];
            const index = new uut.Index();
            index.setParseErrors("fake-uri", errors);

            const result = index.getParseErrors("fake-uri");

            expect(result).to.eql(errors);
        });
    });

    describe("Symbol Locations By Name", () => {
        it("should return undefined for a non-existent symbol", () => {
            const index = new uut.Index();

            const result = index.getSymbolDefinitionByName(
                "nopers",
                uut.TwineSymbolKind.Passage
            );

            expect(result).to.be.undefined;
        });

        it("should return the location of an indexed passage", () => {
            const passages = [
                buildPassage({ label: "Passage 1" }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);

            const result = index.getSymbolDefinitionByName(
                "Passage 2",
                uut.TwineSymbolKind.Passage
            );

            expect(result).to.eql(
                Location.create("fake-uri", Range.create(1, 1, 2, 2))
            );
        });

        it("should return the location of an indexed symbol definition", () => {
            const definitions = [
                {
                    contents: "one",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 12,
                },
                {
                    contents: "two",
                    location: Location.create(
                        "fake-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: 25,
                },
            ];
            const index = new uut.Index();
            index.setDefinitions("fake-uri", definitions);

            const result = index.getSymbolDefinitionByName("two", 25);

            expect(result).to.eql(
                Location.create("fake-uri", Range.create(5, 6, 7, 8))
            );
        });
    });

    describe("Definition At", () => {
        it("should return undefined for a position where no passage name is defined", () => {
            const passages = [
                buildPassage({ label: "Passage 1" }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);

            const result = index.getDefinitionAt(
                "fake-uri",
                Position.create(2, 3)
            );

            expect(result).to.be.undefined;
        });

        it("should return the passage for a position in its name", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);

            const result = index.getDefinitionAt(
                "fake-uri",
                Position.create(4, 4)
            );

            expect(result).to.eql({
                contents: "Passage 2",
                location: Location.create("fake-uri", Range.create(3, 3, 4, 4)),
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return a symbol definition for a position in that definition", () => {
            const definitions = [
                {
                    contents: "one",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 12,
                },
                {
                    contents: "two",
                    location: Location.create(
                        "fake-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: 25,
                },
            ];
            const index = new uut.Index();
            index.setDefinitions("fake-uri", definitions);

            const result = index.getDefinitionAt(
                "fake-uri",
                Position.create(6, 4)
            );

            expect(result).to.eql({
                contents: "two",
                location: Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                kind: 25,
            });
        });
    });

    describe("References At", () => {
        it("should return references for a position in one of that references' locations", () => {
            const references = [
                {
                    contents: "one",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 8,
                },
                {
                    contents: "two",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: 12,
                },
            ];
            const index = new uut.Index();
            index.setReferences("fake-uri", references);

            const result = index.getReferencesAt(
                "fake-uri",
                Position.create(10, 2)
            );

            expect(result).to.eql({
                contents: "two",
                locations: [
                    Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    Location.create("fake-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: 12,
            });
        });
    });

    describe("Definition By Symbol At", () => {
        it("should return undefined for a position where no symbol or reference exists", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getDefinitionBySymbolAt(
                "fake-uri",
                Position.create(2, 3)
            );

            expect(result).to.be.undefined;
        });

        it("should return the passage for a position located at a reference to it", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getDefinitionBySymbolAt(
                "fake-uri",
                Position.create(7, 8)
            );

            expect(result).to.eql({
                contents: "Passage 2",
                location: Location.create("fake-uri", Range.create(3, 3, 4, 4)),
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return the passage for a position located at the actual passage", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getDefinitionBySymbolAt(
                "fake-uri",
                Position.create(1, 8)
            );

            expect(result).to.eql({
                contents: "Passage 1",
                location: Location.create("fake-uri", Range.create(1, 1, 2, 2)),
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return the symbol for a position located at the actual symbol definition", () => {
            const definitions = [
                {
                    contents: "one",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 17,
                },
                {
                    contents: "two",
                    location: Location.create(
                        "fake-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: 25,
                },
            ];
            const index = new uut.Index();
            index.setDefinitions("fake-uri", definitions);

            const result = index.getDefinitionBySymbolAt(
                "fake-uri",
                Position.create(1, 8)
            );

            expect(result).to.eql({
                contents: "one",
                location: Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                kind: 17,
            });
        });
    });

    describe("References To Symbol At", () => {
        it("should return undefined for a position where no symbol or reference exists", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getReferencesToSymbolAt(
                "fake-uri",
                Position.create(2, 3),
                false
            );

            expect(result).to.be.undefined;
        });

        it("should return references for a position located at a reference to it, without the definition", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getReferencesToSymbolAt(
                "fake-uri",
                Position.create(7, 8),
                false
            );

            expect(result).to.eql({
                contents: "Passage 2",
                locations: [
                    Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    Location.create("fake-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return references for a position located at a reference to it, including the definition", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getReferencesToSymbolAt(
                "fake-uri",
                Position.create(7, 8),
                true
            );

            expect(result).to.eql({
                contents: "Passage 2",
                locations: [
                    Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    Location.create("fake-uri", Range.create(9, 10, 11, 12)),
                    Location.create("fake-uri", Range.create(3, 3, 4, 4)),
                ],
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return references for a position located at the actual passage, without the definition", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getReferencesToSymbolAt(
                "fake-uri",
                Position.create(1, 8),
                false
            );

            expect(result).to.eql({
                contents: "Passage 1",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                ],
                kind: uut.TwineSymbolKind.Passage,
            });
        });

        it("should return references for a position located at the actual passage, including the definition", () => {
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(1, 1, 2, 2),
                    },
                }),
                buildPassage({
                    label: "Passage 2",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(3, 3, 4, 4),
                    },
                }),
            ];
            const passageReferences = [
                {
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
                {
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: uut.TwineSymbolKind.Passage,
                },
            ];
            const index = new uut.Index();
            index.setPassages("fake-uri", passages);
            index.setReferences("fake-uri", passageReferences);

            const result = index.getReferencesToSymbolAt(
                "fake-uri",
                Position.create(1, 8),
                true
            );

            expect(result).to.eql({
                contents: "Passage 1",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    Location.create("fake-uri", Range.create(1, 1, 2, 2)),
                ],
                kind: uut.TwineSymbolKind.Passage,
            });
        });
    });

    describe("Passages By Name", () => {
        it("should return a passage from any indexed file", () => {
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

            const result = index.getPassage("F2 P1");

            expect(result).to.eql([passages2[0]]);
        });

        it("should return multiple passages if they share the same name", () => {
            const passages1 = [
                buildPassage({ label: "F1 P1" }),
                buildPassage({ label: "F1 P2" }),
            ];
            const passages2 = [
                buildPassage({ label: "F2 P1" }),
                buildPassage({ label: "F1 P2" }),
            ];
            const index = new uut.Index();
            index.setPassages("file1", passages1);
            index.setPassages("file2", passages2);

            const result = index.getPassage("F1 P2");

            expect(result).to.eql([passages1[1], passages2[1]]);
        });

        it("should return an empty array for a passage name that's not any indexed file", () => {
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

            const result = index.getPassage("f2 p1");

            expect(result).to.be.empty;
        });
    });

    describe("Passages By Location", () => {
        it("should return a passage from any indexed file", () => {
            const passages = [
                buildPassage({
                    label: "F1 P1",
                    scope: Range.create(1, 0, 17, 22),
                }),
                buildPassage({
                    label: "F1 P2",
                    scope: Range.create(18, 0, 22, 29),
                }),
            ];
            const index = new uut.Index();
            index.setPassages("file1", passages);

            const result = index.getPassageAt("file1", Position.create(19, 2));

            expect(result).to.eql(passages[1]);
        });

        it("should return undefined for a location not contained in a passage", () => {
            const passages = [
                buildPassage({
                    label: "F1 P1",
                    scope: Range.create(1, 0, 17, 22),
                }),
                buildPassage({
                    label: "F1 P2",
                    scope: Range.create(18, 0, 22, 29),
                }),
            ];
            const index = new uut.Index();
            index.setPassages("file1", passages);

            const result = index.getPassageAt("file1", Position.create(0, 2));

            expect(result).to.be.undefined;
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

        it("should return passage names with duplicates", () => {
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

            expect(result).to.eql(["F1 P1", "spoiler", "spoiler", "F2 P2"]);
        });
    });

    describe("Getting Indexed URIs", () => {
        it("should return URIs from passages", () => {
            const index = new uut.Index();
            index.setPassages("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return URIs from definitions", () => {
            const index = new uut.Index();
            index.setDefinitions("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return URIs from references", () => {
            const index = new uut.Index();
            index.setReferences("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return URIs from embedded documents", () => {
            const index = new uut.Index();
            index.setEmbeddedDocuments("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return URIs from semantic tokens", () => {
            const index = new uut.Index();
            index.setSemanticTokens("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return URIs from parse errors", () => {
            const index = new uut.Index();
            index.setParseErrors("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
        });

        it("should return each URI once", () => {
            const index = new uut.Index();
            index.setPassages("fake-uri", []);
            index.setReferences("fake-uri", []);
            index.setEmbeddedDocuments("fake-uri", []);
            index.setSemanticTokens("fake-uri", []);
            index.setParseErrors("fake-uri", []);

            const result = index.getIndexedUris();

            expect(result).to.eql(["fake-uri"]);
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
            const docs: EmbeddedDocument[] = [
                EmbeddedDocument.create(
                    "fake-sub-uri",
                    "json",
                    '{ "prop": 7 }',
                    7,
                    TextDocument.create("fake-uri", "", 2, "fake-content")
                ),
            ];
            const index = new uut.Index();
            index.setEmbeddedDocuments("fake-uri", docs);

            index.removeDocument("fake-uri");
            const result = index.getEmbeddedDocuments("fake-uri");

            expect(result).to.be.empty;
        });

        it("should remove definitions from a deleted document", () => {
            const definitions1 = [
                {
                    contents: "one",
                    location: Location.create(
                        "file1",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: 1,
                },
            ];
            const definitions2 = [
                {
                    contents: "two",
                    location: Location.create(
                        "file2",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: 1,
                },
            ];
            const index = new uut.Index();
            index.setDefinitions("file1", definitions1);
            index.setDefinitions("file2", definitions2);

            index.removeDocument("file1");
            const result1 = index.getDefinitions("file1", 1);
            const result2 = index.getDefinitions("file2", 1);

            expect(result1).to.be.undefined;
            expect(result2).to.eql(definitions2);
        });

        it("should remove references from a deleted document", () => {
            const references1 = [
                {
                    contents: "one",
                    locations: [
                        Location.create("file1", Range.create(1, 2, 3, 4)),
                    ],
                    kind: 1,
                },
            ];
            const references2 = [
                {
                    contents: "two",
                    locations: [
                        Location.create("file2", Range.create(5, 6, 7, 8)),
                    ],
                    kind: 1,
                },
            ];
            const index = new uut.Index();
            index.setReferences("file1", references1);
            index.setReferences("file2", references2);

            index.removeDocument("file1");
            const result1 = index.getReferences("file1", 1);
            const result2 = index.getReferences("file2", 1);

            expect(result1).to.be.undefined;
            expect(result2).to.eql(references2);
        });

        it("should remove tokens for a deleted document", () => {
            const fakeTokens: SemanticToken[] = [
                {
                    line: 1,
                    char: 2,
                    length: 3,
                    tokenModifiers: [1],
                    tokenType: 2,
                },
            ];
            const index = new uut.Index();
            index.setSemanticTokens("fake-uri", fakeTokens);

            index.removeDocument("fake-uri");
            const result = index.getSemanticTokens("fake-uri");

            expect(result).to.be.empty;
        });

        it("should remove parse errors for a deleted document", () => {
            const errors = [
                Diagnostic.create(Range.create(1, 1, 2, 2), "Problem 1"),
                Diagnostic.create(Range.create(3, 3, 4, 4), "Another problem"),
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
                Diagnostic.create(Range.create(3, 3, 4, 4), "Another problem"),
            ];
            const index = new uut.Index();
            index.setParseErrors("storytitle-uri", errors);

            index.removeDocument("other-uri");
            const result = index.getParseErrors("storytitle-uri");

            expect(result).to.eql(errors);
        });
    });
});
