import { expect } from "chai";
import "mocha";
import {
    DocumentSymbol,
    Location,
    Range,
    SymbolKind,
} from "vscode-languageserver";

import { Index } from "../index";
import { buildPassage } from "./builders";

import * as uut from "../structure";

describe("Structure", () => {
    describe("Passage Symbols", () => {
        it("should return null for un-indexed files", () => {
            const index = new Index();
            index.setPassages("test-uri", []);

            const result = uut.generateSymbols("other-uri", index);

            expect(result).to.be.null;
        });

        it("should generate namespaces for passages", () => {
            const index = new Index();
            index.setPassages("test-uri", [
                buildPassage({
                    label: "Passage 1",
                    location: Location.create(
                        "test-uri",
                        Range.create(0, 0, 7, 17)
                    ),
                }),
                buildPassage({
                    label: "Passage 2",
                    location: Location.create(
                        "test-uri",
                        Range.create(8, 0, 8, 9)
                    ),
                }),
            ]);

            const result = uut.generateSymbols("test-uri", index);

            expect(result).to.eql([
                DocumentSymbol.create(
                    "Passage 1",
                    undefined,
                    SymbolKind.Namespace,
                    Range.create(0, 0, 7, 17),
                    Range.create(0, 0, 7, 17)
                ),
                DocumentSymbol.create(
                    "Passage 2",
                    undefined,
                    SymbolKind.Namespace,
                    Range.create(8, 0, 8, 9),
                    Range.create(8, 0, 8, 9)
                ),
            ]);
        });
    });
});
