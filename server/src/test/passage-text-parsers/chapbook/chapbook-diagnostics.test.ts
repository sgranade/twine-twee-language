import "mocha";
import { expect } from "chai";
import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "../../../diagnostics";
import { Index } from "../../../project-index";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/types";
import { ArgumentRequirement } from "../../../passage-text-parsers/chapbook/types";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Diagnostics", () => {
    describe("variables", () => {
        it("should warn on a variable with no matching variable setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "This isn't set in any vars or JavaScript section; make sure it's spelled correctly",
                    DiagnosticSeverity.Warning,
                    "variable-never-set",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling non-set variable errors", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.VariableNeverSet]: [Range.create(1, 1, 6, 1)],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a variable with a matching variable setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            index.setReferences("other-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("other-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.VariableSet,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a property with no matching property setting if it matches a built-in JS object's instance property", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {arrayvar.length}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "arrayvar.length",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a reference to a built-in lookup variable", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {passage.name}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "passage",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should warn on a property with no matching property setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1.prop}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "var1.prop",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            index.setReferences("other-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("other-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.VariableSet,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(5, 6, 7, 8),
                    "This isn't set in any vars or JavaScript section; make sure it's spelled correctly",
                    DiagnosticSeverity.Warning,
                    "variable-never-set",
                    "Twine",
                ),
            ]);
        });

        it("should not warn on a property with a matching property setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1.prop}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.Variable,
                },
                {
                    contents: "var1.prop",
                    locations: [
                        Location.create("fake-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.Property,
                },
            ]);
            index.setReferences("other-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("other-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OChapbookSymbolKind.VariableSet,
                },
                {
                    contents: "var1.prop",
                    locations: [
                        Location.create(
                            "other-uri",
                            Range.create(9, 10, 11, 12),
                        ),
                    ],
                    kind: OChapbookSymbolKind.PropertySet,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });
    });

    describe("inserts and modifiers", () => {
        it("should warn on an unrecognized insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {test insert, one: 'here',",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "Unrecognized insert",
                    DiagnosticSeverity.Warning,
                    "unknown-insert",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling unrecognized insert warnings", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {test insert, one: 'here',",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookUnknownInsert]: [
                    Range.create(1, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on an insert that matches a custom insert definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert, one: 'here',",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should error on a custom insert reference with a missing required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 11, 0, 24),
                    "`custom insert` requires a first argument",
                    DiagnosticSeverity.Error,
                    "function-missing-first-argument",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling  custom insert reference with a missing required first argument errors", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookFunctionMissingFirstArgument]: [
                    Range.create(0, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should warn on a custom insert reference with an ignored first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert: 'nope' ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 26, 0, 32),
                    "`custom insert` will ignore this first argument",
                    DiagnosticSeverity.Warning,
                    "function-will-ignore-first-argument",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling custom insert ignored first argument warning", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert: 'nope' ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookFunctionWillIgnoreFirstArgument]: [
                    Range.create(0, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should error on a custom insert reference with a missing required property", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert } ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                    requiredProps: { expected: null, also: null },
                    optionalProps: {},
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 12, 0, 25),
                    "Insert {custom insert} missing expected properties: expected, also",
                    DiagnosticSeverity.Error,
                    "insert-missing-properties",
                    "Twine",
                ),
            ]);
        });

        it("should support disablong custom insert missing required property errors", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert } ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                    requiredProps: { expected: null, also: null },
                    optionalProps: {},
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookInsertMissingProperties]: [
                    Range.create(0, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should warn about a custom insert reference with unexpected properties", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert, prop: 'nope' } ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 27, 0, 31),
                    "Insert {custom insert} will ignore this property",
                    DiagnosticSeverity.Warning,
                    "insert-ignored-property",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling custom insert with unexpected properties warnings", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert, prop: 'nope' } ",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookInsertIgnoredProperty]: [
                    Range.create(0, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should warn on an unrecognized modifier", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mod-me",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "Unrecognized modifier",
                    DiagnosticSeverity.Warning,
                    "unknown-modifier",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling unrecognized modifier warnings", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mod-me",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.ChapbookUnknownModifier]: [
                    Range.create(1, 1, 6, 1),
                ],
            });
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a modifier that matches a custom modifier definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me additional parameters]\nI'm modified!",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /mod-me/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "mod-me",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should error on a custom modifier reference with a missing required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    name: "mod-me",
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /mod-me/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "mod-me",
                    locations: [
                        Location.create("fake-uri", Range.create(0, 1, 0, 7)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 1, 0, 7),
                    "`mod-me` requires a first argument",
                    DiagnosticSeverity.Error,
                    "function-missing-first-argument",
                    "Twine",
                ),
            ]);
        });

        it("should warn on a custom modifier reference with an ignored required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me arg]\nI'm modified!",
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    name: "mod-me",
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /mod-me/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "mod-me",
                    locations: [
                        Location.create("fake-uri", Range.create(0, 1, 0, 7)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 8, 0, 11),
                    "`mod-me` will ignore this first argument",
                    DiagnosticSeverity.Warning,
                    "function-will-ignore-first-argument",
                    "Twine",
                ),
            ]);
        });
    });
});
