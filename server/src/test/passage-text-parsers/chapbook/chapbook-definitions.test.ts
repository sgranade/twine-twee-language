import "mocha";
import { expect } from "chai";
import { Location, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/chapbook-parser";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Definitions", () => {
    it("should return undefined from a position not inside an insert or modifier", () => {
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
                contents: "custom    insert",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomInsert,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getDefinitionAt(
            doc,
            Position.create(9, 4),
            index
        );

        expect(result).to.be.undefined;
    });

    it("should return a custom insert's definition from a position in a use of that insert", () => {
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
                contents: "custom    insert",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomInsert,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getDefinitionAt(
            doc,
            Position.create(1, 4),
            index
        );

        expect(result).to.eql(
            Location.create("source-uri", Range.create(5, 6, 7, 8))
        );
    });

    it("should return a custom modifier's definition from a position in a use of that modifier", () => {
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
                match: /mod\s+me/,
            } as ChapbookSymbol,
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "mod   me",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomModifier,
            },
        ]);
        const diagnosticOptions = defaultDiagnosticsOptions;
        diagnosticOptions.warnings.unknownMacro = true;
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getDefinitionAt(
            doc,
            Position.create(1, 4),
            index
        );

        expect(result).to.eql(
            Location.create("source-uri", Range.create(5, 6, 7, 8))
        );
    });
});
