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
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";

import * as uut from "../../../passage-text-parsers/sugarcube";

describe("Sugarcube Diagnostics", () => {
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
    });
});
