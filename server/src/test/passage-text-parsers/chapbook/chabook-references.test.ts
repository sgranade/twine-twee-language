import "mocha";
import { expect } from "chai";
import { Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
import { OChapbookSymbolKind } from "../../../passage-text-parsers/chapbook/chapbook-parser";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook References", () => {
    it("should return variable set locations from a position inside a variable reference", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("source-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(5, 6, 7, 8)),
                ],
                kind: OChapbookSymbolKind.Variable,
            },
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: OChapbookSymbolKind.VariableSet,
            },
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.Variable,
            },
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(13, 14, 15, 16)),
                ],
                kind: OChapbookSymbolKind.VariableSet,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            doc,
            Position.create(2, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
        ]);
    });

    it("should return variable reference locations from a position inside a variable set", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("source-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(5, 6, 7, 8)),
                ],
                kind: OChapbookSymbolKind.Variable,
            },
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: OChapbookSymbolKind.VariableSet,
            },
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.Variable,
            },
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(13, 14, 15, 16)),
                ],
                kind: OChapbookSymbolKind.VariableSet,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            doc,
            Position.create(14, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
        ]);
    });
});
