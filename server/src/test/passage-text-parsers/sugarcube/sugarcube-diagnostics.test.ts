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

import { DiagnosticCodes } from "@tt3/shared";
import { Index } from "../../../project-index";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";

import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Diagnostics", () => {
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
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "This isn't set in any <<set>> macro, setter link, or JavaScript section; make sure you've spelled it correctly.",
                    DiagnosticSeverity.Warning,
                    "variable-never-set",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling variable with no matching variable setting warnings", () => {
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
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.VariableNeverSet]: [Range.create(1, 1, 6, 1)],
            });
            const parser = uut.getSugarCubeParser(undefined);

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
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            index.setReferences("other-uri", [
                {
                    contents: "var1",
                    locations: [
                        Location.create("other-uri", Range.create(5, 6, 7, 8)),
                    ],
                    kind: OSugarCubeSymbolKind.VariableSet,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a variable with no matching set variable that is a built-in SugarCube variable", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {State.passage}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "State",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a property with no matching set property if it matches a built-in JS object's instance property", () => {
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
                    kind: OSugarCubeSymbolKind.Property,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a property with no matching set property if it matches a SugarCube object's property", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {State.bottom}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "State.bottom",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Property,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on a property with no matching set property if it matches a SugarCube object's instance property", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {any.parser}",
            );
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "any.parser",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OSugarCubeSymbolKind.Property,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });
    });

    describe("macros", () => {
        it("should warn on an unrecognized macro", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>",
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
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    "Unrecognized macro",
                    DiagnosticSeverity.Warning,
                    "unknown-macro",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling unrecognized macro warnings", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>",
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
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.SugarCubeUnknownMacro]: [
                    Range.create(1, 1, 6, 1),
                ],
            });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should not warn on an unrecognized macro if there's a matching macro definition", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try <<this>>",
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
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

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
                        Range.create(1, 2, 3, 4),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    `Widgets can't have the same name as a built-in macro`,
                    DiagnosticSeverity.Error,
                    "no-widget-with-built-in-macro-name",
                    "Twine",
                ),
            ]);
        });

        it("should support disabling a no-macro-with-same-name-as-a-built-in-one error", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("fake-uri", [
                {
                    contents: "if",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.SugarCubeNoWidgetWithBuiltInMacroName]: [
                    Range.create(1, 1, 6, 1),
                ],
            });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });

        it("should error on a macro (widget) that's defined twice", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("fake-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            index.setDefinitions("other-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "other-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.eql([
                Diagnostic.create(
                    Range.create(1, 2, 3, 4),
                    `Widgets can't be defined more than once`,
                    DiagnosticSeverity.Error,
                    "no-multiple-widget-definitions",
                    "Twine",
                    [
                        DiagnosticRelatedInformation.create(
                            Location.create(
                                "other-uri",
                                Range.create(5, 6, 7, 8),
                            ),
                            `Other definition of "testy"`,
                        ),
                    ],
                ),
            ]);
        });

        it("should support disabling duplicate macro (widget) definition errors", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("fake-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 3, 4),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            index.setDefinitions("other-uri", [
                {
                    contents: "testy",
                    location: Location.create(
                        "other-uri",
                        Range.create(5, 6, 7, 8),
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                },
            ]);
            index.setDisabledDiagnosticRanges("fake-uri", {
                [DiagnosticCodes.SugarCubeNoMultipleWidgetDefinitions]: [
                    Range.create(1, 1, 6, 1),
                ],
            });
            const parser = uut.getSugarCubeParser(undefined);

            const results = parser?.generateDiagnostics(doc, index);

            expect(results).to.be.empty;
        });
    });
});
