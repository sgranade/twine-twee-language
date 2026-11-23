import { expect } from "chai";
import "mocha";
import { Diagnostic, Location, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "@tt3/shared";
import { EmbeddedDocument } from "../embedded-languages";
import { updateProjectIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index, TwineSymbolKind } from "../project-index";

import * as uut from "../validator";
import { buildPassage } from "./builders";

describe("Validator", () => {
    describe("Parse Error", () => {
        it("should return parse errors from the index", async () => {
            const errors = [
                Diagnostic.create(
                    Range.create(1, 1, 2, 2),
                    "Your passage names aren't great",
                ),
                Diagnostic.create(
                    Range.create(3, 3, 4, 4),
                    "I question your choice of variables",
                ),
            ];
            const doc = TextDocument.create(
                "test-uri",
                "Twine",
                1.0,
                "Placeholder content",
            );
            const index = new Index();
            index.setParseErrors("test-uri", errors);

            const result = await uut.generateDiagnostics(doc, index);

            expect(result).to.eql(errors);
        });
    });

    describe("Embedded Documents", () => {
        it("should return parse errors from embedded documents", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '012345678\n0123456{ "test": 17, }',
            );
            const embeddedDocument = EmbeddedDocument.create(
                "file:///fake.json",
                "json",
                '{ "test": 17, }',
                17,
                document,
            );
            const index = new Index();
            index.setEmbeddedDocuments("test-uri", [embeddedDocument]);

            const result = await uut.generateDiagnostics(document, index);

            expect(result.length).to.equal(1);
            expect(result[0].message).to.equal("Trailing comma");
        });

        it("should offset embedded document errors by their positions in the larger document", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '012345678\n0123456{ "test": 17, }',
            );
            const embeddedDocument = EmbeddedDocument.create(
                "file:///fake.json",
                "json",
                '{ "test": 17, }',
                17,
                document,
            );
            const index = new Index();
            index.setEmbeddedDocuments("test-uri", [embeddedDocument]);

            const result = await uut.generateDiagnostics(document, index);

            expect(result[0].range).to.eql(Range.create(1, 19, 1, 20));
        });
    });

    describe("Passages", () => {
        it("should warn on repeated passage names in the same document", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }',
            );
            const passages = [
                buildPassage({
                    label: "Passage 1a",
                    location: Location.create(
                        "test-uri",
                        Range.create(1, 1, 2, 3),
                    ),
                }),
                buildPassage({ label: "Passage 1b" }),
                buildPassage({
                    label: "Passage 1a",
                    location: Location.create(
                        "test-uri",
                        Range.create(4, 4, 5, 5),
                    ),
                }),
            ];
            const index = new Index();
            index.setPassages("test-uri", passages);

            const result = await uut.generateDiagnostics(document, index);

            expect(result.length).to.equal(2);
            expect(result[0].message).to.contain(
                "This passage was defined elsewhere",
            );
            expect(result[0].relatedInformation).to.not.be.undefined;
            if (result[0].relatedInformation !== undefined) {
                expect(result[0].relatedInformation[0].location).to.eql(
                    Location.create("test-uri", Range.create(4, 4, 5, 5)),
                );
            }
            expect(result[1].message).to.contain(
                "This passage was defined elsewhere",
            );
            expect(result[1].relatedInformation).to.not.be.undefined;
            if (result[1].relatedInformation !== undefined) {
                expect(result[1].relatedInformation[0].location).to.eql(
                    Location.create("test-uri", Range.create(1, 1, 2, 3)),
                );
            }
        });

        it("should warn on repeated passage names across documents", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }',
            );
            const passages1 = [
                buildPassage({ label: "Passage 1a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "uri-one",
                        Range.create(1, 1, 2, 3),
                    ),
                }),
            ];
            const passages2 = [
                buildPassage({ label: "Passage 2a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "test-uri",
                        Range.create(4, 4, 5, 5),
                    ),
                }),
            ];
            const index = new Index();
            index.setPassages("uri-one", passages1);
            index.setPassages("test-uri", passages2);

            const result = await uut.generateDiagnostics(document, index);

            expect(result.length).to.equal(1);
            expect(result[0].message).to.contain(
                "This passage was defined elsewhere",
            );
            expect(result[0].relatedInformation).to.not.be.undefined;
            if (result[0].relatedInformation !== undefined) {
                expect(result[0].relatedInformation[0].location).to.eql(
                    Location.create("uri-one", Range.create(1, 1, 2, 3)),
                );
            }
        });

        it("should support disabling repeated passage name warnings", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }',
            );
            const passages1 = [
                buildPassage({ label: "Passage 1a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "uri-one",
                        Range.create(1, 1, 2, 3),
                    ),
                }),
            ];
            const passages2 = [
                buildPassage({ label: "Passage 2a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "test-uri",
                        Range.create(4, 4, 5, 5),
                    ),
                }),
            ];
            const index = new Index();
            index.setPassages("uri-one", passages1);
            index.setPassages("test-uri", passages2);
            index.setDisabledDiagnosticRanges("test-uri", {
                [DiagnosticCodes.MultiplePassageDefinitions]: [
                    Range.create(1, 1, 6, 1),
                ],
            });

            const result = await uut.generateDiagnostics(document, index);

            expect(result).to.be.empty;
        });
    });

    describe("Passage References", () => {
        it("should flag passage references that aren't in the index", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }',
            );
            const index = new Index();
            index.setReferences("test-uri", [
                {
                    contents: "Non-existent passage",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: TwineSymbolKind.Passage,
                },
            ]);

            const result = await uut.generateDiagnostics(document, index);

            expect(result.length).to.equal(1);
            expect(result[0].message).to.contain("Cannot find this passage");
        });

        it("should support disabling missing passage reference errors", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }',
            );
            const index = new Index();
            index.setReferences("test-uri", [
                {
                    contents: "Non-existent passage",
                    locations: [
                        Location.create("test-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: TwineSymbolKind.Passage,
                },
            ]);
            index.setDisabledDiagnosticRanges("test-uri", {
                [DiagnosticCodes.MissingPassage]: [Range.create(1, 1, 6, 1)],
            });

            const result = await uut.generateDiagnostics(document, index);

            expect(result).to.be.empty;
        });
    });

    describe("Opaque Assignments", () => {
        const storyData =
            ':: StoryData\n{"ifid": "x", "format": "SugarCube", "format-version": "2.36.1"}\n\n';

        async function neverSetIn(setText: string, readText: string) {
            const index = new Index();
            const setDoc = TextDocument.create(
                "file:///set.tw",
                "twee3",
                1,
                storyData + `:: Setter\n${setText}\n`,
            );
            const readDoc = TextDocument.create(
                "file:///read.tw",
                "twee3",
                1,
                `:: Reader\n${readText}\n`,
            );
            updateProjectIndex(setDoc, ParseLevel.Full, index);
            updateProjectIndex(readDoc, ParseLevel.Full, index);
            return (await uut.generateDiagnostics(readDoc, index))
                .filter((d) => d.code === DiagnosticCodes.VariableNeverSet)
                .map((d) => readDoc.getText(d.range));
        }

        it("should not warn on a property of a call's result set in another file", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<set _r to javaScriptFunction()>>",
                "<<if _r.isError>>x<</if>>",
            );

            expect(result).to.be.empty;
        });

        it("should warn on a property of a variable set to a known shape", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<set $x to 5>>",
                "<<print $x.foo>>",
            );

            expect(result).to.eql(["foo"]);
        });

        it("should warn on a property of a variable only written in a <<print>>", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<set $x to 5>><<print $x = fn()>>",
                "<<print $x.foo>>",
            );

            expect(result).to.eql(["foo"]);
        });

        for (const [desc, setText, readText] of [
            [
                "a copy of a story variable",
                "<<set _p to $player>>",
                "<<print _p.hp>>",
            ],
            [
                "member access",
                "<<set $x to setup.items.sword>>",
                "<<print $x.damage>>",
            ],
            ["element access", "<<set _a to $arr[0]>>", "<<print _a.name>>"],
            ["a new object", "<<set $d to new Date()>>", "<<print $d.year>>"],
            [
                "an object literal with a spread",
                "<<set $o to {...$base, a: 1}>>",
                "<<print $o.b>>",
            ],
            [
                "a destructured call result",
                "<<set [_a, _b] to fn()>>",
                "<<print _b.c>>",
            ],
            [
                "a mix of known and opaque values",
                "<<set $player to {hp: 10}>><<set $player to clone($saved)>>",
                "<<print $player.hpp>>",
            ],
        ]) {
            it(`should not warn on a property of ${desc}`, async () => {
                // No arrange

                const result = await neverSetIn(setText, readText);

                expect(result).to.be.empty;
            });
        }

        it("should warn on a typo'd property of a variable defaulted to itself", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<set $inv to $inv || {}>><<set $inv.sword to 1>>",
                "<<print $inv.sword + $inv.typo>>",
            );

            expect(result).to.eql(["typo"]);
        });

        it("should not warn on a property of a <<for>> range's value variable", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<for _item range $list>><</for>>",
                "<<print _item.name>>",
            );

            expect(result).to.be.empty;
        });

        it("should warn on a property of a <<for>> range's key variable", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<for _k, _v range $obj>><</for>>",
                "<<print _k.foo + _v.bar>>",
            );

            expect(result).to.eql(["foo"]);
        });

        it("should not warn on a property of a <<for>> range's value variable with no space after the comma", async () => {
            // No arrange

            const result = await neverSetIn(
                "<<for _k,_v range $obj>><</for>>",
                "<<print _v.bar>>",
            );

            expect(result).to.be.empty;
        });

        it("should not warn on a property beneath a quoted receiver's property path", async () => {
            // No arrange

            const result = await neverSetIn(
                `<<set $p to {}>><<textbox "$p.stats" "">>`,
                "<<print $p.stats.str>>",
            );

            expect(result).to.be.empty;
        });

        it("should warn on a property of an index variable in a back-ticked receiver", async () => {
            // No arrange

            const result = await neverSetIn(
                '<<set _i to 0>><<textbox `$a[_i]` "">>',
                "<<print _i.x>>",
            );

            expect(result).to.eql(["x"]);
        });

        it("should warn on a property of a variable used as a back-ticked receiver", async () => {
            // No arrange

            const result = await neverSetIn(
                '<<set $target to "$name">><<textbox `$target` "">>',
                "<<print $target.x>>",
            );

            expect(result).to.eql(["x"]);
        });

        for (const setText of [
            `<<checkbox "$r" false true>>`,
            `<<cycle "$r">><<option "a">><</cycle>>`,
            `<<listbox "$r">><<option "a">><</listbox>>`,
            `<<numberbox "$r" 0>>`,
            `<<radiobutton "$r" 1>>`,
            `<<textarea "$r" "">>`,
            `<<textbox "$r" "">>`,
        ]) {
            it(`should not warn on a property of the receiver in ${setText}`, async () => {
                // No arrange

                const result = await neverSetIn(setText, "<<print $r.x>>");

                expect(result).to.be.empty;
            });
        }
    });
});
