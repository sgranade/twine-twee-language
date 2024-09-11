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
} from "../../../passage-text-parsers/chapbook/chapbook-parser";

import * as uut from "../../../passage-text-parsers/chapbook";
import { ArgumentRequirement } from "../../../passage-text-parsers/chapbook/inserts";

describe("Chapbook Diagnostics", () => {
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
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.required,
                        },
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
                    "Insert {custom insert} requires a first argument",
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
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.ignored,
                        },
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
                    "Insert {custom insert} will ignore this first argument",
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
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.ignored,
                        },
                        requiredProps: { expected: null, also: null },
                        optionalProps: {},
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
                    arguments: {
                        firstArgument: {
                            required: ArgumentRequirement.ignored,
                        },
                        requiredProps: {},
                        optionalProps: {},
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
    });
});
