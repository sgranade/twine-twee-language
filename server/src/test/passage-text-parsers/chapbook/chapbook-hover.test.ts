import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { Location, MarkupKind, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildInsertInfo } from "./inserts/insert-builders";
import { buildModifierInfo } from "./modifiers/modifier-builders";
import { Index } from "../../../project-index";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/chapbook-parser";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Hover", () => {
    it("should return a built-in modifier's definition for a position inside a reference to that modifier", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mock-mod",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.BuiltInModifier,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const modifier = buildModifierInfo({
            description: "My description!",
            match: /^mock-mod/,
        });
        const mockFunction = ImportMock.mockFunction(
            modifiersModule,
            "all"
        ).returns([modifier]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "My description!",
            },
        });
    });

    it("should return a built-in modifier's definition along with its syntax for a position inside a reference to that modifier", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mock-mod",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.BuiltInModifier,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const modifier = buildModifierInfo({
            description: "My description!",
            match: /^mock-mod/,
        });
        modifier.syntax = "My syntax";
        const mockFunction = ImportMock.mockFunction(
            modifiersModule,
            "all"
        ).returns([modifier]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "```chapbook\nMy syntax\n```\n\nMy description!",
            },
        });
    });

    it("should return a custom modifier's description for a position inside a reference to that modifier if that description is defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom modifier",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomModifier,
                description: "This is a custom modifier!",
                match: /custom\s+modifier/i,
            } as ChapbookSymbol,
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "custom  modifier",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomModifier,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const mockFunction = ImportMock.mockFunction(
            modifiersModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "This is a custom modifier!",
            },
        });
    });

    it("should return a custom modifier's description and syntax for a position inside a reference to that modifier if its description and syntax are defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom modifier",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomModifier,
                syntax: "[custom modifier]",
                description: "This is a custom modifier!",
                match: /custom\s+modifier/i,
            } as ChapbookSymbol,
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "custom  modifier",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomModifier,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const mockFunction = ImportMock.mockFunction(
            modifiersModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "```chapbook\n[custom modifier]\n```\n\nThis is a custom modifier!",
            },
        });
    });

    it("should return null for a position inside a reference to a custom modifier if that modifier's description isn't defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom modifier",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomModifier,
                match: /custom\s+modifier/i,
            } as ChapbookSymbol,
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "custom  modifier",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomModifier,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const mockFunction = ImportMock.mockFunction(
            modifiersModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.be.null;
    });

    it("should return a built-in insert's description for a position inside a reference to that insert", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mock insert",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.BuiltInInsert,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const insert = buildInsertInfo({
            description: "My description!",
            match: /^mock insert/,
        });
        const mockFunction = ImportMock.mockFunction(
            insertsModule,
            "all"
        ).returns([insert]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "My description!",
            },
        });
    });

    it("should return a built-in insert's description and syntax for a position inside a reference to that insert", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mock insert",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.BuiltInInsert,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const insert = buildInsertInfo({
            description: "My description!",
            match: /^mock insert/,
        });
        insert.syntax = "{mock insert}";
        const mockFunction = ImportMock.mockFunction(
            insertsModule,
            "all"
        ).returns([insert]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "```chapbook\n{mock insert}\n```\n\nMy description!",
            },
        });
    });

    it("should return a custom insert's description for a position inside a reference to that insert if its description is defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom\\s+insert",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomInsert,
                description: "This is a custom insert!",
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
        const mockFunction = ImportMock.mockFunction(
            insertsModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "This is a custom insert!",
            },
        });
    });

    it("should return a custom insert's description and syntax for a position inside a reference to that insert if its description and syntax are defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom\\s+insert",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomInsert,
                description: "This is a custom insert!",
                syntax: "{custom insert}",
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
        const mockFunction = ImportMock.mockFunction(
            insertsModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "```chapbook\n{custom insert}\n```\n\nThis is a custom insert!",
            },
        });
    });

    it("should return null for a position inside a reference to a custom insert whose description isn't defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setDefinitions("source-uri", [
            {
                contents: "custom\\s+insert",
                location: Location.create(
                    "source-uri",
                    Range.create(5, 6, 7, 8)
                ),
                kind: OChapbookSymbolKind.CustomInsert,
                description: "This is a custom insert!",
                match: /custom\s+insert/,
            } as ChapbookSymbol,
        ]);
        index.setReferences("fake-uri", [
            {
                contents: "mock insert",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OChapbookSymbolKind.CustomInsert,
            },
        ]);
        const parser = uut.getChapbookParser(undefined);
        const mockFunction = ImportMock.mockFunction(
            insertsModule,
            "all"
        ).returns([]);

        const result = parser?.generateHover(doc, Position.create(1, 3), index);
        mockFunction.restore();

        expect(result).to.be.null;
    });
});
