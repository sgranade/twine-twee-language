import { expect } from "chai";
import "mocha";
import { Location, Position, Range } from "vscode-languageserver";

import { Index } from "../index";
import { buildPassage } from "./builders";

import * as uut from "../searches";

describe("Searches", () => {
    describe("Definitions", () => {
        it("should return a passage's location at a passage reference", () => {
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
            const passageReferences = {
                "Passage 2": [Range.create(1, 2, 1, 6)],
            };
            index.setPassages("test-uri", passages);
            index.setPassageReferences("other-uri", passageReferences);

            const result = uut.findDefinitions(
                "other-uri",
                Position.create(1, 2),
                index
            );

            expect(result).to.eql(
                Location.create("test-uri", Range.create(8, 0, 8, 9))
            );
        });
    });
});
