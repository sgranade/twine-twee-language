import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildPassage } from "../../builders";
import { Index } from "../../../project-index";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/chapbook-parser";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Completions", () => {
    describe("Variables", () => {
        it("should suggest variables in the vars section", () => {
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
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.items[0]?.label).to.eql("var1");
            expect(results?.items[1]?.label).to.eql("anotherVar");
        });
    });

    describe("Modifiers", () => {
        it("should suggest modifiers after a [ at the start of the line", () => {
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
                Range.create(1, 1, 1, 7)
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
                Range.create(1, 1, 1, 6)
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
                Range.create(1, 11, 1, 17)
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
                Range.create(1, 1, 1, 7)
            );
        });

        it("should suggest modifiers within [...; here]", () => {
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
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateCompletions(doc, position, index);

            expect(results?.itemDefaults?.editRange).to.eql(
                Range.create(1, 11, 1, 16)
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    requiredProps: {
                        one: "true",
                        two: "'falsy'",
                    },
                    optionalProps: {},
                },
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    requiredProps: {
                        one: "true",
                        two: "'falsy'",
                    },
                    optionalProps: {},
                },
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.required,
                        placeholder: "'URL'",
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
                parse: () => {},
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
                            required:
                                insertsModule.ArgumentRequirement.required,
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

        it("should suggest passages after a { and a , and a : for a built-in insert's first arguments that take a passage", () => {
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                        type: insertsModule.ValueType.passage,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
                parse: () => {},
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

        it("should suggest passages after a { and a , and a : for a built-in insert's first arguments that take a urlOrPassage", () => {
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                        type: insertsModule.ValueType.urlOrPassage,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
                parse: () => {},
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                        type: insertsModule.ValueType.passage,
                    },
                    requiredProps: {},
                    optionalProps: {},
                },
                parse: () => {},
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: { one: null },
                    optionalProps: { two: { placeholder: "'value'" } },
                },
                parse: () => {},
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: { one: null },
                    optionalProps: { two: null },
                },
                parse: () => {},
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
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: { one: null },
                    optionalProps: { two: null },
                },
                parse: () => {},
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
            const insert: insertsModule.InsertInfo = {
                name: "test insert",
                syntax: "test insert",
                description: "desc",
                match: /^test\s+insert/i,
                completions: ["test insert"],
                arguments: {
                    firstArgument: {
                        required: insertsModule.ArgumentRequirement.optional,
                    },
                    requiredProps: {
                        one: {
                            placeholder: "arg",
                            type: insertsModule.ValueType.passage,
                        },
                    },
                    optionalProps: { two: null },
                },
                parse: () => {},
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
