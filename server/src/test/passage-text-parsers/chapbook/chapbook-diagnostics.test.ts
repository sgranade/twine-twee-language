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
