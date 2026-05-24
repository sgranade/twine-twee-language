import { expect } from "chai";
import "mocha";
import { Location, Position, Range, TextEdit } from "vscode-languageserver";

import { Index, TwineSymbolKind } from "../../../project-index";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import { buildPassage } from "../../builders";

import * as uut from "../../../passage-text-parsers/sugarcube/sugarcube-renames";

describe("SugarCube Renames", () => {
    it("should return null for non-variable renames", () => {
        const references = [
            {
                contents: "prop",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 4)),
                ],
                kind: OSugarCubeSymbolKind.Property,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", references);

        const result = uut.generateRenames(
            "fake-uri",
            Position.create(5, 3),
            "renamed",
            index,
        );

        expect(result).to.be.null;
    });

    it("should rename variables at the variable's definition", () => {
        const definitionReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 6)),
                ],
                kind: OSugarCubeSymbolKind.VariableSet,
            },
        ];
        const otherReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("other-uri", Range.create(7, 4, 7, 8)),
                ],
                kind: OSugarCubeSymbolKind.Variable,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", definitionReferences);
        index.setReferences("other-uri", otherReferences);

        const result = uut.generateRenames(
            "fake-uri",
            Position.create(5, 3),
            "$renamed",
            index,
        );

        expect(result).to.eql({
            "fake-uri": [
                TextEdit.replace(Range.create(5, 2, 5, 6), "$renamed"),
            ],
            "other-uri": [
                TextEdit.replace(Range.create(7, 4, 7, 8), "$renamed"),
            ],
        });
    });

    it("should rename variables at a reference to the variable", () => {
        const definitionReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 6)),
                ],
                kind: OSugarCubeSymbolKind.VariableSet,
            },
        ];
        const otherReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("other-uri", Range.create(7, 4, 7, 8)),
                ],
                kind: OSugarCubeSymbolKind.Variable,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", definitionReferences);
        index.setReferences("other-uri", otherReferences);

        const result = uut.generateRenames(
            "other-uri",
            Position.create(7, 5),
            "$renamed",
            index,
        );

        expect(result).to.eql({
            "fake-uri": [
                TextEdit.replace(Range.create(5, 2, 5, 6), "$renamed"),
            ],
            "other-uri": [
                TextEdit.replace(Range.create(7, 4, 7, 8), "$renamed"),
            ],
        });
    });

    it("should rename State.variables variables at a reference to the Twinescript variable", () => {
        const definitionReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 6)),
                ],
                kind: OSugarCubeSymbolKind.VariableSet,
            },
        ];
        const otherReferences = [
            {
                contents: "$var",
                // Note that locations is only 3 chars wide because the actual text is `State.variables.var`
                locations: [
                    Location.create("other-uri", Range.create(7, 4, 7, 7)),
                ],
                kind: OSugarCubeSymbolKind.Variable,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", definitionReferences);
        index.setReferences("other-uri", otherReferences);

        const result = uut.generateRenames(
            "fake-uri",
            Position.create(5, 2),
            "$renamed",
            index,
        );

        expect(result).to.eql({
            "fake-uri": [
                TextEdit.replace(Range.create(5, 2, 5, 6), "$renamed"),
            ],
            "other-uri": [
                TextEdit.replace(Range.create(7, 4, 7, 7), "renamed"),
            ],
        });
    });

    it("should rename State.variables variables at a reference to the State.variable variable", () => {
        const definitionReferences = [
            {
                contents: "$var",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 6)),
                ],
                kind: OSugarCubeSymbolKind.VariableSet,
            },
        ];
        const otherReferences = [
            {
                contents: "$var",
                // Note that locations is only 3 chars wide because the actual text is `State.variables.var`
                locations: [
                    Location.create("other-uri", Range.create(7, 4, 7, 7)),
                ],
                kind: OSugarCubeSymbolKind.Variable,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", definitionReferences);
        index.setReferences("other-uri", otherReferences);

        const result = uut.generateRenames(
            "other-uri",
            Position.create(7, 5),
            "renamed",
            index,
        );

        expect(result).to.eql({
            "fake-uri": [
                TextEdit.replace(Range.create(5, 2, 5, 6), "$renamed"),
            ],
            "other-uri": [
                TextEdit.replace(Range.create(7, 4, 7, 7), "renamed"),
            ],
        });
    });

    it("should rename State.temporary variables at a reference to the State.temporary variable", () => {
        const definitionReferences = [
            {
                contents: "_var",
                locations: [
                    Location.create("fake-uri", Range.create(5, 2, 5, 6)),
                ],
                kind: OSugarCubeSymbolKind.VariableSet,
            },
        ];
        const otherReferences = [
            {
                contents: "_var",
                // Note that locations is only 3 chars wide because the actual text is `State.temporary.var`
                locations: [
                    Location.create("other-uri", Range.create(7, 4, 7, 7)),
                ],
                kind: OSugarCubeSymbolKind.Variable,
            },
        ];
        const index = new Index();
        index.setReferences("fake-uri", definitionReferences);
        index.setReferences("other-uri", otherReferences);

        const result = uut.generateRenames(
            "other-uri",
            Position.create(7, 5),
            "renamed",
            index,
        );

        expect(result).to.eql({
            "fake-uri": [
                TextEdit.replace(Range.create(5, 2, 5, 6), "_renamed"),
            ],
            "other-uri": [
                TextEdit.replace(Range.create(7, 4, 7, 7), "renamed"),
            ],
        });
    });
});
