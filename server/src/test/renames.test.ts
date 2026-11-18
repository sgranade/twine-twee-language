import "mocha";
import { expect } from "chai";
import {
    Location,
    OptionalVersionedTextDocumentIdentifier,
    Position,
    Range,
    ResponseError,
    TextDocumentEdit,
    TextEdit,
    WorkspaceEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormatParser } from "../passage-text-parsers/types";
import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index, ScriptFileRole, TwineSymbolKind } from "../project-index";
import { buildPassage } from "./builders";

import * as uut from "../renames";

describe("Renames", () => {
    describe("Prepare Renames", () => {
        it("should return the range of a definition at the location", () => {
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "defined",
                    kind: TwineSymbolKind.Passage,
                    location: Location.create(
                        "source-uri",
                        Range.create(3, 4, 3, 7),
                    ),
                },
            ]);

            const result = uut.prepareRename(
                "source-uri",
                Position.create(3, 5),
                index,
            );

            expect(result).to.eql(Range.create(3, 4, 3, 7));
        });

        it("should return the range of a reference at the location", () => {
            const index = new Index();
            index.setReferences("source-uri", [
                {
                    contents: "defined",
                    kind: TwineSymbolKind.Passage,
                    locations: [
                        Location.create("source-uri", Range.create(3, 4, 3, 7)),
                    ],
                },
            ]);

            const result = uut.prepareRename(
                "source-uri",
                Position.create(3, 5),
                index,
            );

            expect(result).to.eql(Range.create(3, 4, 3, 7));
        });
    });

    describe("Generate Renames", () => {
        describe("Passages", () => {
            it("should preferentially return renames from a story format", () => {
                const passages = [
                    buildPassage({
                        label: "Passage 1",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(1, 1, 2, 2),
                        },
                    }),
                ];
                const passageReferences = [
                    {
                        contents: "Passage 1",
                        locations: [
                            Location.create(
                                "other-uri",
                                Range.create(5, 2, 5, 4),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                ];
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "fake-uri",
                    Position.create(1, 2),
                    "New Passage 1",
                    index,
                    () => {
                        return {
                            id: "FakeFormat",
                            generateRenamesAt: () => {
                                return {
                                    "totally-other-uri": [
                                        TextEdit.replace(
                                            Range.create(5, 2, 5, 6),
                                            "$renamed",
                                        ),
                                    ],
                                };
                            },
                        } as unknown as StoryFormatParser;
                    },
                );

                expect(result).to.eql({
                    changes: {
                        "totally-other-uri": [
                            TextEdit.replace(
                                Range.create(5, 2, 5, 6),
                                "$renamed",
                            ),
                        ],
                    },
                });
            });

            it("should return no renames if a story format returns undefined", () => {
                const passages = [
                    buildPassage({
                        label: "Passage 1",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(1, 1, 2, 2),
                        },
                    }),
                ];
                const passageReferences = [
                    {
                        contents: "Passage 1",
                        locations: [
                            Location.create(
                                "other-uri",
                                Range.create(5, 2, 5, 4),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                ];
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "fake-uri",
                    Position.create(1, 2),
                    "New Passage 1",
                    index,
                    () => {
                        return {
                            id: "FakeFormat",
                            generateRenamesAt: () => undefined,
                        } as unknown as StoryFormatParser;
                    },
                );

                expect(result).to.be.null;
            });

            it("should rename passages at the passage's actual location", () => {
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
                            Location.create(
                                "other-uri",
                                Range.create(5, 2, 5, 4),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                    {
                        contents: "Passage 2",
                        locations: [
                            Location.create(
                                "other-uri",
                                Range.create(5, 6, 7, 8),
                            ),
                            Location.create(
                                "other-uri",
                                Range.create(9, 10, 11, 12),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                ];
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "fake-uri",
                    Position.create(1, 2),
                    "New Passage 1",
                    index,
                );

                expect(result).to.eql({
                    changes: {
                        "fake-uri": [
                            TextEdit.replace(
                                Range.create(1, 1, 2, 2),
                                "New Passage 1",
                            ),
                        ],
                        "other-uri": [
                            TextEdit.replace(
                                Range.create(5, 2, 5, 4),
                                "New Passage 1",
                            ),
                        ],
                    },
                });
            });

            it("should rename passages at a reference to the passage", () => {
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
                            Location.create(
                                "other-uri",
                                Range.create(5, 2, 5, 4),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                    {
                        contents: "Passage 2",
                        locations: [
                            Location.create(
                                "other-uri",
                                Range.create(5, 6, 7, 8),
                            ),
                            Location.create(
                                "other-uri",
                                Range.create(9, 10, 11, 12),
                            ),
                        ],
                        kind: TwineSymbolKind.Passage,
                    },
                ];
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "other-uri",
                    Position.create(5, 4),
                    "New Passage 1",
                    index,
                );

                expect(result).to.eql({
                    changes: {
                        "fake-uri": [
                            TextEdit.replace(
                                Range.create(1, 1, 2, 2),
                                "New Passage 1",
                            ),
                        ],
                        "other-uri": [
                            TextEdit.replace(
                                Range.create(5, 2, 5, 4),
                                "New Passage 1",
                            ),
                        ],
                    },
                });
            });
        });
    });

    describe("Story Variables in .js Files", () => {
        interface ProjectFile {
            uri: string;
            content: string;
            role?: ScriptFileRole;
        }

        const storyData = (format: string, version: string) =>
            `:: StoryData\n{"ifid": "x", "format": "${format}", "format-version": "${version}"}\n\n`;

        function buildProject(files: ProjectFile[]): {
            index: Index;
            docs: Record<string, TextDocument>;
        } {
            const index = new Index();
            const docs: Record<string, TextDocument> = {};
            for (const file of files) {
                docs[file.uri] = TextDocument.create(
                    file.uri,
                    file.role ? "javascript" : "twee3",
                    1,
                    file.content,
                );
            }
            for (const file of files.filter((f) => !f.role)) {
                updateProjectIndex(docs[file.uri], ParseLevel.Full, index);
            }
            for (const file of files.filter((f) => f.role)) {
                updateScriptFileIndex(
                    docs[file.uri],
                    file.role as ScriptFileRole,
                    ParseLevel.Full,
                    index,
                );
            }
            return { index, docs };
        }

        function positionOf(doc: TextDocument, marker: string): Position {
            const at = doc.getText().indexOf(marker);
            if (at < 0) throw new Error(`No "${marker}" in ${doc.uri}`);
            return doc.positionAt(at);
        }

        // The text of each changed file after applying a workspace edit
        function applied(
            docs: Record<string, TextDocument>,
            edit: WorkspaceEdit | null | unknown,
        ): Record<string, string> {
            const result: Record<string, string> = {};
            const changes = (edit as WorkspaceEdit | null)?.changes ?? {};
            for (const [uri, edits] of Object.entries(changes)) {
                result[uri] = TextDocument.applyEdits(docs[uri], edits);
            }
            return result;
        }

        describe("SugarCube", () => {
            const sugarcube = storyData("SugarCube", "2.36.1");

            it("should rewrite only the name in each state root when renaming from twee", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                    {
                        uri: "file:///s.js",
                        content:
                            "State.variables.gold = 2;\nvariables().gold;\nconst v = State.variables;\nv.gold;\nState.variables['gold'];\n",
                        role: "story-script",
                    },
                ]);
                const tw = docs["file:///story.tw"];

                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "$gold"),
                    "$coins",
                    index,
                );

                expect(applied(docs, result)).to.eql({
                    "file:///story.tw":
                        sugarcube + ":: Start\n<<set $coins to 1>>\n",
                    "file:///s.js":
                        "State.variables.coins = 2;\nvariables().coins;\nconst v = State.variables;\nv.coins;\nState.variables['coins'];\n",
                });
            });

            it("should keep the sigil inside getVar strings and add the original sigil when it's omitted", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                    {
                        uri: "file:///s.js",
                        content:
                            "State.getVar('$gold');\nState.variables.gold;\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    js.uri,
                    positionOf(js, "gold;"),
                    "coins",
                    index,
                );

                expect(applied(docs, result)).to.eql({
                    "file:///story.tw":
                        sugarcube + ":: Start\n<<set $coins to 1>>\n",
                    "file:///s.js":
                        "State.getVar('$coins');\nState.variables.coins;\n",
                });
            });

            it("should accept the original sigil typed from a .js file", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                    {
                        uri: "file:///s.js",
                        content: "State.variables.gold;\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    js.uri,
                    positionOf(js, "gold"),
                    "$coins",
                    index,
                );

                expect(applied(docs, result)).to.eql({
                    "file:///story.tw":
                        sugarcube + ":: Start\n<<set $coins to 1>>\n",
                    "file:///s.js": "State.variables.coins;\n",
                });
            });

            it("should keep the local binding when renaming a shorthand destructured name", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                    {
                        uri: "file:///s.js",
                        content: "const { gold, hp: h } = State.variables;\n",
                        role: "story-script",
                    },
                ]);
                const tw = docs["file:///story.tw"];

                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "$gold"),
                    "$coins",
                    index,
                );

                expect(applied(docs, result)["file:///s.js"]).to.equal(
                    "const { coins: gold, hp: h } = State.variables;\n",
                );
            });

            it("should rename only the key of a renamed destructured name", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///s.js",
                        content:
                            "State.variables.hp = 1;\nconst { gold, hp: h } = State.variables;\n",
                        role: "story-script",
                    },
                    { uri: "file:///story.tw", content: sugarcube },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    js.uri,
                    positionOf(js, "hp"),
                    "health",
                    index,
                );

                expect(applied(docs, result)["file:///s.js"]).to.equal(
                    "State.variables.health = 1;\nconst { gold, health: h } = State.variables;\n",
                );
            });

            it("should version edits to open buffers and leave closed files unversioned when the client supports document changes", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                    {
                        uri: "file:///s.js",
                        content: "State.variables.gold;\n",
                        role: "story-script",
                    },
                ]);
                const tw = docs["file:///story.tw"];
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "$gold"),
                    "$coins",
                    index,
                    undefined,
                    {
                        documentChanges: true,
                        versionOf: (uri) => (uri === tw.uri ? 7 : null),
                    },
                );

                expect(result).to.eql({
                    documentChanges: [
                        TextDocumentEdit.create(
                            OptionalVersionedTextDocumentIdentifier.create(
                                tw.uri,
                                7,
                            ),
                            [
                                TextEdit.replace(
                                    Range.create(
                                        positionOf(tw, "$gold"),
                                        positionOf(tw, " to 1"),
                                    ),
                                    "$coins",
                                ),
                            ],
                        ),
                        TextDocumentEdit.create(
                            OptionalVersionedTextDocumentIdentifier.create(
                                js.uri,
                                null,
                            ),
                            [
                                TextEdit.replace(
                                    Range.create(
                                        positionOf(js, "gold"),
                                        positionOf(js, ";"),
                                    ),
                                    "coins",
                                ),
                            ],
                        ),
                    ],
                });
            });

            it("should refuse a new property name that isn't a JavaScript identifier", () => {
                const { index, docs } = buildProject([
                    { uri: "file:///story.tw", content: sugarcube },
                    {
                        uri: "file:///s.js",
                        content: "State.variables.gold.amount = 2;\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    js.uri,
                    positionOf(js, "amount"),
                    "not valid",
                    index,
                );

                expect(result).to.be.instanceOf(ResponseError);
            });

            it("should refuse to change a $ variable into a _ variable", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                ]);
                const tw = docs["file:///story.tw"];

                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "$gold"),
                    "_gold",
                    index,
                );

                expect(result).to.be.instanceOf(ResponseError);
                expect((result as ResponseError).message).to.include(
                    "swapping between `$` story variables and `_` temporary variables",
                );
            });

            it("should refuse a new name that isn't a JavaScript identifier", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: sugarcube + ":: Start\n<<set $gold to 1>>\n",
                    },
                ]);
                const tw = docs["file:///story.tw"];

                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "$gold"),
                    "$gold-coins",
                    index,
                );

                expect(result).to.be.instanceOf(ResponseError);
                expect((result as ResponseError).message).to.include(
                    "gold-coins",
                );
            });
        });

        describe("Chapbook", () => {
            const chapbook = storyData("Chapbook", "2.3.0");
            const twee = {
                uri: "file:///story.tw",
                content: chapbook + ":: Start\ngold: 1\n--\n{gold}\n",
            };

            function renameFromTwee(
                files: ProjectFile[],
                newName: string,
            ): {
                result: ReturnType<typeof uut.generateRenames>;
                docs: Record<string, TextDocument>;
            } {
                const { index, docs } = buildProject([twee, ...files]);
                const tw = docs[twee.uri];
                const result = uut.generateRenames(
                    tw.uri,
                    positionOf(tw, "gold"),
                    newName,
                    index,
                );
                return { result, docs };
            }

            it("should rewrite one segment of a dotted key and whole bare names", () => {
                // No arrange

                const { result, docs } = renameFromTwee(
                    [
                        {
                            uri: "file:///s.js",
                            content:
                                "engine.state.get('gold.purse');\nconsole.log(gold);\n",
                            role: "story-script",
                        },
                    ],
                    "coins",
                );

                expect(applied(docs, result)["file:///s.js"]).to.equal(
                    "engine.state.get('coins.purse');\nconsole.log(coins);\n",
                );
            });

            it("should refuse a new name that isn't a JavaScript identifier", () => {
                // No arrange

                const { result } = renameFromTwee([], "gold coins");

                expect(result).to.be.instanceOf(ResponseError);
            });

            it("should refuse a new property name that isn't a JavaScript identifier", () => {
                const { index, docs } = buildProject([
                    twee,
                    {
                        uri: "file:///s.js",
                        content: "engine.state.get('gold.amount');\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.generateRenames(
                    js.uri,
                    positionOf(js, "amount"),
                    "not valid",
                    index,
                );

                expect(result).to.be.instanceOf(ResponseError);
            });

            it("should refuse a reserved word when an edit lands on a bare name", () => {
                // No arrange

                const { result } = renameFromTwee(
                    [
                        {
                            uri: "file:///s.js",
                            content: "console.log(gold);\n",
                            role: "story-script",
                        },
                    ],
                    "class",
                );

                expect(result).to.be.instanceOf(ResponseError);
                expect((result as ResponseError).message).to.include(
                    "reserved word",
                );
            });

            it("should allow a reserved word when no edit lands on a bare name", () => {
                // No arrange

                const { result, docs } = renameFromTwee(
                    [
                        {
                            uri: "file:///s.js",
                            content: "engine.state.get('gold');\n",
                            role: "story-script",
                        },
                    ],
                    "class",
                );

                expect(applied(docs, result)["file:///s.js"]).to.equal(
                    "engine.state.get('class');\n",
                );
            });

            it("should refuse a bare-name rename onto a root-level declaration, naming the conflict", () => {
                // No arrange

                const { result } = renameFromTwee(
                    [
                        {
                            uri: "file:///s.js",
                            content: "console.log(gold);\n",
                            role: "story-script",
                        },
                        {
                            uri: "file:///helpers.js",
                            content: "function coins() {}\n",
                            role: "story-script",
                        },
                    ],
                    "coins",
                );

                expect(result).to.be.instanceOf(ResponseError);
                expect((result as ResponseError).message)
                    .to.include("coins")
                    .and.to.include("file:///helpers.js");
            });

            it("should refuse a bare-name rename onto an excluded name, naming the conflict", () => {
                // No arrange

                const { result } = renameFromTwee(
                    [
                        {
                            uri: "file:///s.js",
                            content: "console.log(gold);\n",
                            role: "story-script",
                        },
                    ],
                    "document",
                );

                expect(result).to.be.instanceOf(ResponseError);
                expect((result as ResponseError).message).to.include(
                    "document",
                );
            });
        });

        describe("Prepare Renames", () => {
            it("should return the sigil-free name range on a SugarCube variable", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: storyData("SugarCube", "2.36.1"),
                    },
                    {
                        uri: "file:///s.js",
                        content: "State.getVar('$gold');\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.prepareRename(
                    js.uri,
                    positionOf(js, "old"),
                    index,
                );

                expect(result).to.eql(
                    Range.create(positionOf(js, "gold"), positionOf(js, "')")),
                );
            });

            it("should return null on alias bindings, root expressions and other strings", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content: storyData("SugarCube", "2.36.1"),
                    },
                    {
                        uri: "file:///s.js",
                        content:
                            "const v = State.variables;\nv.gold;\nconsole.log('gold');\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                for (const marker of ["v =", "State", "gold');"]) {
                    expect(
                        uut.prepareRename(
                            js.uri,
                            positionOf(js, marker),
                            index,
                        ),
                        marker,
                    ).to.be.undefined;
                }
            });

            it("should return the range of a Chapbook conditional reference that qualifies", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content:
                            storyData("Chapbook", "2.3.0") +
                            ":: Start\ngold: 1\n--\n",
                    },
                    {
                        uri: "file:///s.js",
                        content: "console.log(gold);\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                const result = uut.prepareRename(
                    js.uri,
                    positionOf(js, "gold"),
                    index,
                );

                expect(result).to.eql(
                    Range.create(positionOf(js, "gold"), positionOf(js, ");")),
                );
            });

            it("should return null on Chapbook declarations and conditional references that don't qualify", () => {
                const { index, docs } = buildProject([
                    {
                        uri: "file:///story.tw",
                        content:
                            storyData("Chapbook", "2.3.0") +
                            ":: Start\ngold: 1\n--\n",
                    },
                    {
                        uri: "file:///s.js",
                        content: "var helper = 1;\nconsole.log(unset);\n",
                        role: "story-script",
                    },
                ]);
                const js = docs["file:///s.js"];

                for (const marker of ["helper", "unset"]) {
                    expect(
                        uut.prepareRename(
                            js.uri,
                            positionOf(js, marker),
                            index,
                        ),
                        marker,
                    ).to.be.undefined;
                }
            });
        });
    });
});
