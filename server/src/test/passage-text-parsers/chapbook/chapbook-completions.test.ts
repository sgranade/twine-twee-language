import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { Location, Position, Range, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildPassage } from "../../builders";
import { Index } from "../../../project-index";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/types";
import {
    ArgumentRequirement,
    ValueType,
} from "../../../passage-text-parsers/chapbook/types";
import { buildInsertInfo } from "./inserts/insert-builders";
import { buildModifierInfo } from "./modifiers/modifier-builders";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Completions", () => {
    describe("Variables", () => {
        it("should suggest variables (both set and otherwise) in the vars section", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nv\n--\nContent"
            );
            const position = Position.create(1, 1);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 4, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "anotherVar",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.VariableSet,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(2);
            expect(results?.items[0]?.label).to.eql("var1");
            expect(results?.items[1]?.label).to.eql("anotherVar");
        });

        it("should suggest properties (both set and otherwise) that follow a variable in the vars section", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nvar1.\n--\nContent"
            );
            const position = Position.create(1, 5);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 4, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "nope.prop",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.PropertySet,
                },
                {
                    contents: "var1.otherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
                {
                    contents: "var1.anotherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(13, 14, 15, 16)
                        ),
                    ],
                    kind: OChapbookSymbolKind.PropertySet,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(2);
            expect(results?.items[0]?.label).to.eql("otherprop");
            expect(results?.items[1]?.label).to.eql("anotherprop");
        });
    });

    describe("Modifiers", () => {
        it("should suggest built-in modifiers after a [ at the start of the line", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ here "
            );
            const position = Position.create(1, 4);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 2, 1, 7)
            );
        });

        it("should suggest custom modifiers after a [ at the start of the line", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ here "
            );
            const position = Position.create(1, 4);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom modifier",
                    name: "custom modifier",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /custom\s+modifier/i,
                } as ChapbookSymbol,
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0]?.label).to.eql("custom modifier");
        });

        it("should suggest modifiers within [ ...;", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ here; not here "
            );
            const position = Position.create(1, 4);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 2, 1, 6)
            );
        });

        it("should suggest modifiers within [...; here", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ not here; here \nnot here"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 17)
            );
        });

        it("should suggest modifiers within [...]", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ here ] not here"
            );
            const position = Position.create(1, 4);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 2, 1, 7)
            );
        });

        it("should suggest modifiers within [...; ^here]", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ not here; here] not here"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 16)
            );
            expect(results?.items[0].textEditText).to.equal("mod");
        });

        it("should suggest modifiers within [...; here^]", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ not here; here] not here"
            );
            const position = Position.create(1, 16);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 12, 1, 16)
            );
            expect(results?.items[0].textEditText).to.equal("mod");
        });

        it("should suggest a built-in modifier's required first argument's placeholder after a [ and the modifier name", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ mod "
            );
            const position = Position.create(1, 6);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            modifier.firstArgument = {
                required: ArgumentRequirement.required,
                placeholder: "'URL'",
            };
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql("mod '${1:URL}'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 2, 1, 6)
            );
        });

        it("should suggest a custom modifier's required first argument's placeholder after a [ and the modifier name", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ custom mod "
            );
            const position = Position.create(1, 4);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    name: "custom mod",
                    contents: "custom mod",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /^custom mod/i,
                } as ChapbookSymbol,
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom mod '${1:URL}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 2, 1, 13)
            );
        });

        it("should suggest variables after a [ and modifier name for a built-in modifier's first argument that takes an expression", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ mod "
            );
            const position = Position.create(1, 6);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            modifier.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.expression,
            };
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("var1");
        });

        it("should suggest properties after a [, modifier name, and variable for a built-in modifier's first argument that takes an expression", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ mod var1."
            );
            const position = Position.create(1, 11);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "nope.prop",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.PropertySet,
                },
                {
                    contents: "var1.otherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            modifier.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.expression,
            };
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("otherprop");
        });

        it("should suggest passages after a [ and modifier name for a built-in modifier's first argument that takes a passage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ mod "
            );
            const position = Position.create(1, 6);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            modifier.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.passage,
            };
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 6, 1, 6)
            );
        });

        it("should suggest passages after a [ and modifier name for a custom modifier's first argument that takes a passage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ custom mod "
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom mod",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /^custom mod/i,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                        type: ValueType.passage,
                    },
                } as ChapbookSymbol,
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 13, 1, 13)
            );
        });

        it("should suggest passages after a [ and modifier name for a built-in modifier's first argument that takes a urlOrPassage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ mod "
            );
            const position = Position.create(1, 6);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const modifier = buildModifierInfo({ name: "mod", match: /^mod/i });
            modifier.completions = ["mod"];
            modifier.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.urlOrPassage,
            };
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 6, 1, 6)
            );
        });

        it("should suggest passages after a [ and modifier name for a custom modifier's first argument that takes a urlOrPassage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\n[ custom mod "
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom mod",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /^custom mod/i,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                        type: ValueType.urlOrPassage,
                    },
                } as ChapbookSymbol,
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 13, 1, 13)
            );
        });
    });

    describe("Inserts", () => {
        it("should suggest built-in insert names after a {", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.optional,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("test insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should suggest custom insert names after a {", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0]?.label).to.eql("custom insert");
        });

        it("should suggest variables after a { with no other contents in the insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {va"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("var1");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should suggest properties after a { and variable. with no other contents in the insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {var1.o"
            );
            const position = Position.create(1, 17);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "var1.otherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("otherprop");
            expect(results?.items[0].textEdit).to.eql(
                TextEdit.replace(Range.create(1, 16, 1, 17), "otherprop")
            );
        });

        it("should not suggest variables after a { if there are other contents in the insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {va nope"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items).to.be.empty;
        });

        it("should suggest built-in insert names after a { and only replace the word the position is in", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te nope"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.optional,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("test insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should suggest built-in insert names after a { and before a ,", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te, prop: 'yep'"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.optional,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("test insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should suggest built-in insert names after a { and before a :", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te: 'first arg'"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.optional,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("test insert");
            expect(results?.items[0].textEditText).to.eql("test insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should suggest custom insert names after a { and before a :", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te: 'first arg'"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("custom insert");
            expect(results?.items[0].textEditText).to.eql("custom insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should add a colon for a built-in insert with a required first argument after a { with no colon of its own", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.required,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "test insert: '${1:arg}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should add a colon for a custom insert with a required first argument after a { with no colon of its own", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                        },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom insert: '${1:arg}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should add a colon for a built-in insert with a required first argument after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                firstArgument: {
                    required: ArgumentRequirement.required,
                },
                requiredProps: {},
                optionalProps: {},
                parse: () => {},
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "test insert: '${1:arg}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should add a colon for a custom insert with a required first argument after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                        },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom insert: '${1:arg}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should include a built-in insert's required first argument's placeholder after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.required,
                placeholder: "'URL'",
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "test insert: '${1:URL}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should include a custom insert's required first argument's placeholder after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom insert: '${1:URL}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should include a built-in insert's required first argument and properties' placeholders after a {", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te "
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: { one: "true", two: "'falsy'" },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.required,
                placeholder: "'URL'",
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "test insert: '${1:URL}', one: ${2:true}, two: '${3:falsy}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should include a custom insert's required first argument and properties' placeholders after a {", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te "
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    requiredProps: {
                        one: "true",
                        two: "'falsy'",
                    },
                    optionalProps: {},
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {
                            one: "true",
                            two: "'falsy'",
                        },
                        optionalProps: {},
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom insert: '${1:URL}', one: ${2:true}, two: '${3:falsy}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 13)
            );
        });

        it("should include a built-in insert's required first argument's placeholder but no required properties' placeholders after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.required,
                placeholder: "'URL'",
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "test insert: '${1:URL}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should include a custom insert's required first argument's placeholder but no required properties' placeholders after a { with a comma", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te ,"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {
                            one: "true",
                            two: "'falsy'",
                        },
                        optionalProps: {},
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql(
                "custom insert: '${1:URL}'"
            );
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should not add a colon after a { with a colon already there for a built-in insert with a required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te :"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.required,
                placeholder: "'URL'",
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql("test insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should not add a colon after a { with a colon already there for a custom insert with a required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {te :"
            );
            const position = Position.create(1, 12);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].textEditText).to.eql("custom insert");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 14)
            );
        });

        it("should suggest variables after a { and a , and a : for a built-in insert's first argument that takes an expression", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert: }"
            );
            const position = Position.create(1, 24);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.expression,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("var1");
        });

        it("should suggest properties after a { and a , and a :, and a variable for a built-in insert's first argument that takes an expression", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert: var1.}"
            );
            const position = Position.create(1, 29);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "var1.otherprop",
                    locations: [
                        Location.create(
                            "fake-uri",
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.expression,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("otherprop");
        });

        it("should suggest passages after a { and a , and a : for a built-in insert's first argument that takes a passage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert: }"
            );
            const position = Position.create(1, 24);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.passage,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 24, 1, 24)
            );
        });

        it("should suggest passages after a { and a , and a : for a custom insert's first argument that takes a passage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {custom insert: }"
            );
            const position = Position.create(1, 26);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                        type: ValueType.passage,
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 26, 1, 26)
            );
        });

        it("should suggest passages after a { and a , and a : for a built-in insert's first argument that takes a urlOrPassage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert: }"
            );
            const position = Position.create(1, 24);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.urlOrPassage,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("passage");
            expect(results?.items[0].textEditText).to.eql("'passage'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 24, 1, 24)
            );
        });

        it("should suggest passages after a { and a , and a : for a custom insert's first argument that takes a urlOrPassage", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {custom insert: }"
            );
            const position = Position.create(1, 26);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                        type: ValueType.urlOrPassage,
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("'I'm a passage!'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 26, 1, 26)
            );
        });

        it("should suggest first argument passages inside existing quote marks", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: I'm a passage!\nLet's try {test insert: 'placeholder' }"
            );
            const position = Position.create(1, 27);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
                type: ValueType.passage,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("I'm a passage!");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 25, 1, 36)
            );
        });

        it("should suggest built-in insert properties after a { and a ,", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert, "
            );
            const position = Position.create(1, 23);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: { one: null },
                optionalProps: { two: { placeholder: "'value'" } },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("one");
            expect(results?.items[0].textEditText).to.eql(" one: '${1:arg}'");
            expect(results?.items[1].label).to.eql("two");
            expect(results?.items[1].textEditText).to.eql(" two: '${1:value}'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 23, 1, 23)
            );
        });

        it("should suggest custom insert properties after a { and a ,", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {custom insert, "
            );
            const position = Position.create(1, 25);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {
                        one: null,
                    },
                    optionalProps: { two: "'value'" },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                        },
                        requiredProps: {
                            one: null,
                        },
                        optionalProps: { two: "'value'" },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("one");
            expect(results?.items[0].textEditText).to.eql(" one: '${1:arg}'");
            expect(results?.items[1].label).to.eql("two");
            expect(results?.items[1].textEditText).to.eql(" two: '${1:value}'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 25, 1, 25)
            );
        });

        it("should suggest built-in insert properties after a { and a , changing only the property at the completion position", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert, :"
            );
            const position = Position.create(1, 23);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: { one: null },
                optionalProps: { two: null },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("one");
            expect(results?.items[0].textEditText).to.eql(" one: '${1:arg}'");
            expect(results?.items[1].label).to.eql("two");
            expect(results?.items[1].textEditText).to.eql(" two: '${1:arg}'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 23, 1, 25)
            );
        });

        it("should suggest custom insert properties after a { and a , changing only the property at the completion position", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {custom insert, :"
            );
            const position = Position.create(1, 25);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setDefinitions("source-uri", [
                {
                    contents: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/i,
                    completions: ["custom insert"],
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {
                        one: null,
                    },
                    optionalProps: { two: null },
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                        },
                        requiredProps: {
                            one: null,
                        },
                        optionalProps: { two: null },
                    },
                } as ChapbookSymbol,
            ]);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("one");
            expect(results?.items[0].textEditText).to.eql(" one: '${1:arg}'");
            expect(results?.items[1].label).to.eql("two");
            expect(results?.items[1].textEditText).to.eql(" two: '${1:arg}'");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 25, 1, 27)
            );
        });

        it("should not suggest built-in insert property values after a { and a , and a : for general properties", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert, : 'here'"
            );
            const position = Position.create(1, 28);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "passage",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: { one: null },
                optionalProps: { two: null },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results).to.be.null;
        });

        it("should suggest variables for built-in insert property values that take an expression after a { and a , and a :", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert, one: 'here',"
            );
            const position = Position.create(1, 30);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: {
                    one: {
                        placeholder: "arg",
                        type: ValueType.expression,
                    },
                },
                optionalProps: { two: null },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0]?.label).to.eql("var1");
        });

        it("should suggest passages for built-in insert property values that take a passage after a { and a , and a :", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                ":: Passage\nLet's try {test insert, one: 'here',"
            );
            const position = Position.create(1, 30);
            const index = new Index();
            index.setPassages("fake-uri", [
                buildPassage({
                    label: "I'm a passage!",
                    scope: Range.create(0, 0, 2, 0),
                }),
            ]);
            const insert = buildInsertInfo({
                name: "test insert",
                match: /^test\s+insert/i,
                requiredProps: {
                    one: {
                        placeholder: "arg",
                        type: ValueType.passage,
                    },
                },
                optionalProps: { two: null },
            });
            insert.completions = ["test insert"];
            insert.firstArgument = {
                required: ArgumentRequirement.optional,
            };
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);
            mockFunction.restore();

            expect(results?.items[0].label).to.eql("I'm a passage!");
            expect(results?.items[0].textEditText).to.eql("I'm a passage!");
            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 30, 1, 34)
            );
        });
    });
});
