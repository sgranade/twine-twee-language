import { expect } from "chai";
import "mocha";
import { Position, Range, TextEdit } from "vscode-languageserver";

import { Index } from "../project-index";
import { buildPassage } from "./builders";

import * as uut from "../searches";

describe("Searches", () => {
    describe("Renames", () => {
        describe("Passages", () => {
            it("should rename passages at the passage's actual location", () => {
                const passages = [
                    buildPassage({
                        label: "Passage 1",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(1, 1, 2, 2),
                        },
                    }),
                    buildPassage({
                        label: "Passage 2",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(3, 3, 4, 4),
                        },
                    }),
                ];
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "fake-uri",
                    Position.create(1, 2),
                    "New Passage 1",
                    index
                );

                expect(result).to.eql({
                    changes: {
                        "fake-uri": [
                            TextEdit.replace(
                                Range.create(1, 1, 2, 2),
                                "New Passage 1"
                            ),
                        ],
                        "other-uri": [
                            TextEdit.replace(
                                Range.create(5, 2, 5, 4),
                                "New Passage 1"
                            ),
                        ],
                    },
                });
            });

            it("should rename passages at a reference to the passage", () => {
                const passages = [
                    buildPassage({
                        label: "Passage 1",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(1, 1, 2, 2),
                        },
                    }),
                    buildPassage({
                        label: "Passage 2",
                        location: {
                            uri: "fake-uri",
                            range: Range.create(3, 3, 4, 4),
                        },
                    }),
                ];
                const passageReferences = {
                    "Passage 1": [Range.create(5, 2, 5, 4)],
                    "Passage 2": [
                        Range.create(5, 6, 7, 8),
                        Range.create(9, 10, 11, 12),
                    ],
                };
                const index = new Index();
                index.setPassages("fake-uri", passages);
                index.setPassageReferences("other-uri", passageReferences);

                const result = uut.generateRenames(
                    "other-uri",
                    Position.create(5, 4),
                    "New Passage 1",
                    index
                );

                expect(result).to.eql({
                    changes: {
                        "fake-uri": [
                            TextEdit.replace(
                                Range.create(1, 1, 2, 2),
                                "New Passage 1"
                            ),
                        ],
                        "other-uri": [
                            TextEdit.replace(
                                Range.create(5, 2, 5, 4),
                                "New Passage 1"
                            ),
                        ],
                    },
                });
            });
        });
    });
});
