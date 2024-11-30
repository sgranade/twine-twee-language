import "mocha";
import { expect } from "chai";
import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";

import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Diagnostics", () => {
    describe("macros", () => {
        it("should warn on an unrecognized macro", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>"
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "this",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.UnknownMacro,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    'Macro "this" not recognized',
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should not warn on an unrecognized macro if there's a matching macro definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>"
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "this",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.UnknownMacro,
                },
            ]);
            index.setDefinitions("other-uri", [
                {
                    contents: "this",
                    location: Location.create(
                        "other-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should not warn on an unrecognized macro if that warning is disabled", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>"
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "this",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.UnknownMacro,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = false;
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                diagnosticOptions
            );

            expect(results).to.be.empty;
        });

        it("should error on a macro (widget) definition with the same name as a built-in macro", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("fake-uri", [
                {
                    contents: "if",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                defaultDiagnosticsOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    `Widget "if" can't have the same name as a built-in macro`,
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                ),
            ]);
        });

        it("should error on a macro (widget) that's defined twice", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("fake-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
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
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(
                doc,
                index,
                defaultDiagnosticsOptions
            );

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    `Widget "testy" can't be defined more than once`,
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine",
                    [
                        DiagnosticRelatedInformation.create(
                            Location.create(
                                "other-uri",
                                Range.create(5, 6, 7, 8)
                            ),
                            `Other definition of "testy"`
                        ),
                    ]
                ),
            ]);
        });
    });
});
