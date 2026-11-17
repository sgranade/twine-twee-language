import "mocha";
import { expect } from "chai";
import { Location, Position, Range } from "vscode-languageserver";

import { Index } from "../../../project-index";
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
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(2, 1),
            index,
            true,
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
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(14, 1),
            index,
            true,
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
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(2, 1),
            index,
            true,
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
        const parser = uut.getChapbookParser(undefined);

        const result = parser?.getReferencesToSymbolAt(
            "fake-uri",
            Position.create(14, 1),
            index,
            true,
        );

        expect(result).to.eql([
            Location.create("source-uri", Range.create(9, 10, 11, 12)),
            Location.create("fake-uri", Range.create(13, 14, 15, 16)),
            Location.create("source-uri", Range.create(5, 6, 7, 8)),
            Location.create("fake-uri", Range.create(1, 2, 3, 4)),
        ]);
    });

    describe("Conditional References", () => {
        function buildIndex(declaredInScriptPassage: boolean): Index {
            const index = new Index();
            index.setReferences("vars-uri", [
                {
                    contents: "gold",
                    locations: [
                        Location.create("vars-uri", Range.create(1, 0, 1, 4)),
                    ],
                    kind: OChapbookSymbolKind.VariableSet,
                },
            ]);
            const scriptRefs = [
                {
                    contents: "gold",
                    locations: [
                        Location.create("script-uri", Range.create(2, 0, 2, 4)),
                    ],
                    kind: OChapbookSymbolKind.ConditionalReference,
                },
            ];
            if (declaredInScriptPassage) {
                scriptRefs.push({
                    contents: "gold",
                    locations: [
                        Location.create("script-uri", Range.create(3, 0, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.RootDeclaration,
                });
            }
            index.setReferences("script-uri", scriptRefs);
            return index;
        }

        it("should include a conditional reference when the project defines the variable", () => {
            const parser = uut.getChapbookParser(undefined);

            const result = parser?.getReferencesToSymbolAt(
                "vars-uri",
                Position.create(1, 1),
                buildIndex(false),
                false,
            );

            expect(result).to.eql([
                Location.create("vars-uri", Range.create(1, 0, 1, 4)),
                Location.create("script-uri", Range.create(2, 0, 2, 4)),
            ]);
        });

        it("should exclude conditional references bound by a root-level declaration", () => {
            const parser = uut.getChapbookParser(undefined);
            const index = buildIndex(true);

            const fromSet = parser?.getReferencesToSymbolAt(
                "vars-uri",
                Position.create(1, 1),
                index,
                false,
            );
            const fromConditional = parser?.getReferencesToSymbolAt(
                "script-uri",
                Position.create(2, 1),
                index,
                false,
            );
            const rename = parser?.generateRenamesAt(
                "script-uri",
                Position.create(2, 1),
                "silver",
                index,
            );

            expect(fromSet).to.eql([
                Location.create("vars-uri", Range.create(1, 0, 1, 4)),
            ]);
            expect(fromConditional).to.be.undefined;
            expect(rename).to.be.undefined;
        });

        it("should exclude conditional references to variables the project never defines", () => {
            const index = new Index();
            index.setReferences("script-uri", [
                {
                    contents: "gold",
                    locations: [
                        Location.create("script-uri", Range.create(2, 0, 2, 4)),
                    ],
                    kind: OChapbookSymbolKind.ConditionalReference,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);

            const result = parser?.getReferencesToSymbolAt(
                "script-uri",
                Position.create(2, 1),
                index,
                false,
            );

            expect(result).to.be.undefined;
        });
    });
});
