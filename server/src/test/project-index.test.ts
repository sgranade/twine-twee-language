import { expect } from "chai";
import "mocha";
import { Diagnostic, Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildPassage } from "./builders";

import { EmbeddedDocument } from "../embedded-languages";
import * as uut from "../project-index";
import { SemanticToken } from "../tokens";

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

        describe("Passage References", () => {
            it("should return undefined for unindexed files", () => {
                const index = new uut.Index();

                const result = index.getPassageReferences("nopers");

                expect(result).to.be.undefined;
            });

            it("should return passages for indexed files", () => {
                const passageReferences = {
                    "Passage 1": [Range.create(1, 2, 3, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getPassageReferences("fake-uri");

                expect(result).to.eql(passageReferences);
            });
        });

        describe("Symbol Locations", () => {
            it("should return undefined for a non-existent passage", () => {
                const index = new uut.Index();

                const result = index.getSymbolLocation(
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

                const result = index.getSymbolLocation(
                    "Passage 2",
                    uut.TwineSymbolKind.Passage
                );

                expect(result).to.eql(
                    Location.create("fake-uri", Range.create(1, 1, 2, 2))
                );
            });
        });

        describe("Symbol At", () => {
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

                const result = index.getSymbolAt(
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

                const result = index.getSymbolAt(
                    "fake-uri",
                    Position.create(4, 4)
                );

                expect(result).to.eql({
                    contents: "Passage 2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(3, 3, 4, 4)
                    ),
                    kind: uut.TwineSymbolKind.Passage,
                });
            });
        });

        describe("Definition At", () => {
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getDefinitionAt(
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getDefinitionAt(
                    "fake-uri",
                    Position.create(7, 8)
                );

                expect(result).to.eql({
                    contents: "Passage 2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(3, 3, 4, 4)
                    ),
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getDefinitionAt(
                    "fake-uri",
                    Position.create(1, 8)
                );

                expect(result).to.eql({
                    contents: "Passage 1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 1, 2, 2)
                    ),
                    kind: uut.TwineSymbolKind.Passage,
                });
            });
        });

        describe("References At", () => {
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getReferencesAt(
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getReferencesAt(
                    "fake-uri",
                    Position.create(7, 8),
                    false
                );

                expect(result).to.eql({
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getReferencesAt(
                    "fake-uri",
                    Position.create(7, 8),
                    true
                );

                expect(result).to.eql({
                    contents: "Passage 2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                        Location.create("fake-uri", Range.create(3, 3, 4, 4)),
                    ],
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getReferencesAt(
                    "fake-uri",
                    Position.create(1, 8),
                    false
                );

                expect(result).to.eql({
                    contents: "Passage 1",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                    ],
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
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new uut.Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("fake-uri", passageReferences);

                const result = index.getReferencesAt(
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
                });
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

        describe("Getting indexed URIs", () => {
            it("should return URIs from passages", () => {
                const index = new uut.Index();
                index.setPassages("fake-uri", []);

                const result = index.getIndexedUris();

                expect(result).to.eql(["fake-uri"]);
            });

            it("should return URIs from references", () => {
                const index = new uut.Index();
                index.setPassageReferences("fake-uri", {});

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
                index.setPassageReferences("fake-uri", {});
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
                    },
                ];
                const index = new uut.Index();
                index.setEmbeddedDocuments("fake-uri", docs);

                index.removeDocument("fake-uri");
                const result = index.getEmbeddedDocuments("fake-uri");

                expect(result).to.be.empty;
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
