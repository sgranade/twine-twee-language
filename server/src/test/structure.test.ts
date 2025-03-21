import { expect } from "chai";
import "mocha";
import {
    DocumentSymbol,
    FoldingRange,
    Location,
    Range,
    SymbolKind,
} from "vscode-languageserver";

import { Index } from "../project-index";
import { SemanticToken } from "../semantic-tokens";
import { buildPassage } from "./builders";

import * as uut from "../structure";

describe("Structure", () => {
    describe("Symbols", () => {
        it("should return null for un-indexed files", () => {
            const index = new Index();
            index.setPassages("test-uri", []);

            const result = uut.generateSymbols("other-uri", index);

            expect(result).to.be.null;
        });

        it("should generate class symbols for passages", () => {
            const index = new Index();
            const passages = [
                buildPassage({
                    label: "Passage 1",
                    location: Location.create(
                        "test-uri",
                        Range.create(0, 0, 0, 12)
                    ),
                    scope: Range.create(0, 0, 7, 17),
                }),
                buildPassage({
                    label: "Passage 2",
                    location: Location.create(
                        "test-uri",
                        Range.create(8, 0, 8, 9)
                    ),
                    scope: Range.create(8, 0, 9, 2),
                }),
            ];
            index.setPassages("test-uri", passages);

            const result = uut.generateSymbols("test-uri", index);

            expect(result).to.eql([
                DocumentSymbol.create(
                    "Passage 1",
                    undefined,
                    SymbolKind.Class,
                    Range.create(0, 0, 7, 17),
                    Range.create(0, 0, 0, 12)
                ),
                DocumentSymbol.create(
                    "Passage 2",
                    undefined,
                    SymbolKind.Class,
                    Range.create(8, 0, 9, 2),
                    Range.create(8, 0, 8, 9)
                ),
            ]);
        });

        it("should skip class symbols for passages whose name is empty", () => {
            const index = new Index();
            const passages = [
                buildPassage({
                    label: "",
                    location: Location.create(
                        "test-uri",
                        Range.create(0, 0, 0, 3)
                    ),
                    scope: Range.create(0, 0, 0, 13),
                }),
            ];
            index.setPassages("test-uri", passages);

            const result = uut.generateSymbols("test-uri", index);

            expect(result).to.be.empty;
        });
    });

    describe("Folding Ranges", () => {
        it("should return null for un-indexed files", () => {
            const index = new Index();
            index.setPassages("test-uri", []);

            const result = uut.generateFoldingRanges("other-uri", index);

            expect(result).to.be.null;
        });

        it("should generate folding ranges for an indexed file", () => {
            const index = new Index();
            index.setFoldingRanges("test-uri", [
                Range.create(0, 0, 7, 17),
                Range.create(8, 0, 9, 2),
            ]);

            const result = uut.generateFoldingRanges("test-uri", index);

            expect(result).to.eql([
                FoldingRange.create(0, 7),
                FoldingRange.create(8, 9),
            ]);
        });
    });

    describe("Decoration Ranges", () => {
        it("should return an empty array for un-indexed files", () => {
            const index = new Index();
            index.setPassages("test-uri", []);

            const result = uut.generateDecorationRanges("other-uri", index);

            expect(result).to.be.empty;
        });

        it("should generate decoration ranges for an indexed file", () => {
            const index = new Index();
            index.setDecorationRanges("test-uri", [
                { type: 1, range: Range.create(0, 0, 7, 17) },
                { type: 1, range: Range.create(8, 0, 9, 2) },
            ]);

            const result = uut.generateDecorationRanges("test-uri", index);

            expect(result).to.eql([
                { type: 1, range: Range.create(0, 0, 7, 17) },
                { type: 1, range: Range.create(8, 0, 9, 2) },
            ]);
        });
    });

    describe("Semantic Tokens", () => {
        it("should return an empty set of tokens for un-indexed files", () => {
            const index = new Index();
            index.setPassages("test-uri", []);

            const result = uut.generateSemanticTokens("other-uri", index);

            expect(result.data).to.be.empty;
        });

        it("should generate tokens for indexed files", () => {
            const index = new Index();
            const tokens: SemanticToken[] = [
                {
                    line: 5,
                    char: 4,
                    length: 3,
                    tokenType: 2,
                    tokenModifiers: [0b1, 0b10],
                },
            ];
            index.setSemanticTokens("test-uri", tokens);

            const result = uut.generateSemanticTokens("test-uri", index);

            expect(result.data).to.eql([5, 4, 3, 2, 0b11]);
        });
    });
});
