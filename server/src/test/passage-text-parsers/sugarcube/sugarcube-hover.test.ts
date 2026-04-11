import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { Location, MarkupKind, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildMacroInfo } from "./macros/macro-builders";
import { Index } from "../../../project-index";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import * as macrosModule from "../../../passage-text-parsers/sugarcube/macros";

import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Hover", () => {
    it("should return a built-in macro's definition for a position inside a reference to that macro", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mockro", // this is objectively a very funny name for a mock macro
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OSugarCubeSymbolKind.KnownMacro,
            },
        ]);
        const parser = uut.getSugarCubeParser(undefined);
        const macro = buildMacroInfo({
            name: "mockro",
            description: "My description!",
        });
        const mockFunction = ImportMock.mockFunction(
            macrosModule,
            "allMacros"
        ).returns({ mockro: macro });

        const result = parser?.generateHover(
            doc,
            Position.create(1, 3),
            [],
            index
        );
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "My description!",
            },
        });
    });

    it("should substitute enum values in a built-in macro's definition", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mockro", // this is objectively a very funny name for a mock macro
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OSugarCubeSymbolKind.KnownMacro,
            },
        ]);
        const parser = uut.getSugarCubeParser(undefined);
        const macro = buildMacroInfo({
            name: "mockro",
            description: "My %enum% description!",
        });
        const mockFunction1 = ImportMock.mockFunction(
            macrosModule,
            "allMacros"
        ).returns({ mockro: macro });
        const mockFunction2 = ImportMock.mockFunction(
            macrosModule,
            "allMacroEnums"
        ).returns({ enum: "replaced" });

        const result = parser?.generateHover(
            doc,
            Position.create(1, 3),
            [],
            index
        );
        mockFunction1.restore();
        mockFunction2.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "My replaced description!",
            },
        });
    });

    it("should return a built-in macro's definition along with its syntax for a position inside a reference to that macro", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mockro",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OSugarCubeSymbolKind.KnownMacro,
            },
        ]);
        const parser = uut.getSugarCubeParser(undefined);
        const macro = buildMacroInfo({
            name: "mockro",
            description: "My description!",
        });
        macro.syntax = "My syntax";
        const mockFunction = ImportMock.mockFunction(
            macrosModule,
            "allMacros"
        ).returns({ mockro: macro });

        const result = parser?.generateHover(
            doc,
            Position.create(1, 3),
            [],
            index
        );
        mockFunction.restore();

        expect(result).to.eql({
            contents: {
                kind: MarkupKind.Markdown,
                value: "```sugarcube\nMy syntax\n```\n\nMy description!",
            },
        });
    });

    it("should return null for a position inside a reference to a macro if that macro's description isn't defined", () => {
        const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
        const index = new Index();
        index.setReferences("fake-uri", [
            {
                contents: "mockro",
                locations: [
                    Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                ],
                kind: OSugarCubeSymbolKind.KnownMacro,
            },
        ]);
        const parser = uut.getSugarCubeParser(undefined);
        const macro = buildMacroInfo({
            name: "mockro",
        });
        macro.description = undefined;
        const mockFunction = ImportMock.mockFunction(
            macrosModule,
            "allMacros"
        ).returns({ mockro: macro });

        const result = parser?.generateHover(
            doc,
            Position.create(1, 3),
            [],
            index
        );
        mockFunction.restore();

        expect(result).to.be.null;
    });
});
