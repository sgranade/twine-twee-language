import "mocha";
import { expect } from "chai";
import { Location, Position, Range } from "vscode-languageserver";

import { Index } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
import { OChapbookSymbolKind } from "../../../passage-text-parsers/chapbook/types";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook References", () => {
    it("should include variable set locations from a position inside a variable reference", () => {
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
            "fake-uri",
            Position.create(2, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
        ]);
    });

    it("should include variable reference locations from a position inside a variable set", () => {
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
            "fake-uri",
            Position.create(14, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
        ]);
    });

    it("should include property set locations from a position inside a property reference", () => {
        const index = new Index();
        index.setReferences("source-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(5, 6, 7, 8)),
                ],
                kind: OChapbookSymbolKind.Property,
            },
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: OChapbookSymbolKind.PropertySet,
            },
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.Property,
            },
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(13, 14, 15, 16)),
                ],
                kind: OChapbookSymbolKind.PropertySet,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(2, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
        ]);
    });

    it("should include property reference locations from a position inside a property set", () => {
        const index = new Index();
        index.setReferences("source-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(5, 6, 7, 8)),
                ],
                kind: OChapbookSymbolKind.Property,
            },
            {
                contents: "var",
                locations: [
                    Location.create("source-uri", Range.create(9, 10, 11, 12)),
                ],
                kind: OChapbookSymbolKind.PropertySet,
            },
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.Property,
            },
            {
                contents: "var",
                locations: [
                    Location.create("fake-uri", Range.create(13, 14, 15, 16)),
                ],
                kind: OChapbookSymbolKind.PropertySet,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(14, 1),
            index,
            true
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
        ]);
    });
});
