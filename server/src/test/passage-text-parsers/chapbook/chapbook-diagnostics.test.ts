import "mocha";
import { expect } from "chai";
import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
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
                "Let's try {var1}"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "\"var1\" isn't set in any vars section. Make sure you've spelled it correctly.",
                    DiagnosticSeverity.Warning
                ),
            ]);
        });

        it("should not warn on a variable with a matching variable setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1}"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should not warn on a reference to a built-in lookup variable", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {passage.name}"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should warn on a property with no matching property setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1.prop}"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(5, 6, 7, 8),
                    "\"var1.prop\" isn't set in any vars section. Make sure you've spelled it correctly.",
                    DiagnosticSeverity.Warning
                ),
            ]);
        });

        it("should not warn on a property with a matching property setting", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {var1.prop}"
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
                            Range.create(9, 10, 11, 12)
                        ),
                    ],
                    kind: OChapbookSymbolKind.PropertySet,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });
    });

    describe("inserts and modifiers", () => {
        it("should warn on an unrecognized insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {test insert, one: 'here',"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    'Insert "custom insert" not recognized',
                    DiagnosticSeverity.Warning
                ),
            ]);
        });

        it("should not warn on an unrecognized insert if that warning is disabled", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {test insert, one: 'here',"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = false;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should not warn on an insert that matches a custom insert definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert, one: 'here',"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should error on a custom insert reference with a missing required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert "
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 11, 0, 24),
                    "`custom insert` requires a first argument",
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should warn on a custom insert reference with an ignored first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert: 'nope' "
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 26, 0, 32),
                    "`custom insert` will ignore this first argument",
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should error on a custom insert reference with a missing required property", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert } "
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 12, 0, 25),
                    "Insert {custom insert} missing expected properties: expected, also",
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should warn about a custom insert reference with unexpected properties", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try { custom insert, prop: 'nope' } "
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    name: "custom insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 27, 0, 31),
                    "Insert {custom insert} will ignore this property",
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should warn on an unrecognized modifier", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    'Modifier "mod-me" not recognized',
                    DiagnosticSeverity.Warning
                ),
            ]);
        });

        it("should not warn on an unrecognized modifier if that warning is disabled", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!"
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = false;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should not warn on a modifier that matches a custom modifier definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me additional parameters]\nI'm modified!"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should error on a custom modifier reference with a missing required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me]\nI'm modified!"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    name: "mod-me",
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 1, 0, 7),
                    "`mod-me` requires a first argument",
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should warn on a custom modifier reference with an ignored required first argument", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me arg]\nI'm modified!"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    name: "mod-me",
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
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
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(0, 8, 0, 11),
                    "`mod-me` will ignore this first argument",
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                ),
            ]);
        });
    });
});
