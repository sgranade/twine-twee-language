import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { Location, Position, Range, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../../../project-index";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import { buildMacroInfo } from "./macros/macro-builders";

import * as macrosModule from "../../../passage-text-parsers/sugarcube/macros";
import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Completions", () => {
    describe("Variables", () => {
        it("should suggest variables after a $", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nIt's a $v\n"
            );
            const position = Position.create(1, 9);
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "$var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "_var2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("$var1");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 7, 1, 9)
            );
        });

        it("should suggest variables after a _", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nIt's a _v\n"
            );
            const position = Position.create(1, 9);
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "$var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "_var2",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("_var2");
        });

        it("should suggest properties that follow a variable", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n$var1."
            );
            const position = Position.create(1, 6);
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "$var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "_nope.prop",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OSugarCubeSymbolKind.Property,
                },
                {
                    contents: "$var1.otherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OSugarCubeSymbolKind.Property,
                },
                {
                    contents: "$var1.anotherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(13, 14, 15, 16)
                        ),
                    ],
                    kind: OSugarCubeSymbolKind.Property,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );

            expect(results?.items.length).to.equal(2);
            expect(results?.items[0]?.label).to.eql("otherprop");
            expect(results?.items[1]?.label).to.eql("anotherprop");
        });
    });

    describe("Macros", () => {
        it("should suggest macro names after a <<", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy" });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should suggest defined macros (widgets) after a <<", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setDefinitions("other-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "other-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({});
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should suggest macro names after a << with no duplication between known macros and widgets", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setDefinitions("other-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "other-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const macro = buildMacroInfo({ name: "testy" });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].label).to.eql("testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should only replace macro names after a << up to any space or non-word character", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te>>"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy" });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should include a tab stop and closing container macro after a << with no other text and no arguments", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = undefined;
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(
                    Range.create(1, 12, 1, 14),
                    "testy>>${0}<</testy>>"
                )
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should include a tab stop inside the opening macro and a closing container macro after a << with no other text for macros with boolean true arguments", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = true;
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(
                    Range.create(1, 12, 1, 14),
                    "testy ${0}>><</testy>>"
                )
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should include a tab stop inside the opening macro and a closing container macro after a << with no other text for macros with string array arguments", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = ["text"];
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(
                    Range.create(1, 12, 1, 14),
                    "testy ${0}>><</testy>>"
                )
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should include closing container macro names and a tab stop after a << with no other text before a >>", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te  >>"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = false;
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(
                    Range.create(1, 12, 1, 18),
                    "testy>>${0}<</testy>>"
                )
            );
        });

        it("should include closing container macro names and a tab stop after a << with following text but no >>", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te other stuff"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = undefined;
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(
                    Range.create(1, 12, 1, 14),
                    "testy>>${0}<</testy>>"
                )
            );
        });

        it("should include no closing container macro after a << with following text and a >>", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<te other arguments>> stuff"
            );
            const position = Position.create(1, 14);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            macro.arguments = false;
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("testy");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 14)
            );
        });

        it("should include closing macros for container macros after a >>", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try <<other>> <<testy fooble nope>>"
            );
            const position = Position.create(1, 41);
            const index = new Index();
            const macro = buildMacroInfo({ name: "testy", container: true });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateCompletions(
                doc,
                position,
                [],
                index
            );
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("<</testy>>");
        });
    });
});
