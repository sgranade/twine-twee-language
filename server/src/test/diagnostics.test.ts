import "mocha";
import { expect } from "chai";

import { Range, Location } from "vscode-languageserver";

import { Label } from "../project-index";

import * as uut from "../diagnostics";

describe("Diagnostics", () => {
    describe("Disabling", () => {
        it("should return disabled diagnostics from tag labels", () => {
            const tags: Label[] = [
                {
                    contents: "tt3-disable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 1, 1, 11),
                    ),
                },
                {
                    contents:
                        "incorrect-javascript,missing-passage,incorrect-javascript",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 13, 1, 70),
                    ),
                },
            ];

            const [disabledCodes, _] =
                uut.disabledDiagnosticsFromPassageTagLabels(tags);

            expect(disabledCodes).to.eql(
                new Set(["incorrect-javascript", "missing-passage"]),
            );
        });

        it("should return unrecognized diagnostics from tag labels", () => {
            const tags: Label[] = [
                {
                    contents: "tt3-disable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 1, 1, 11),
                    ),
                },
                {
                    contents: "incorrect-javascript,nope,missing-passage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 13, 1, 59),
                    ),
                },
            ];

            const [disabledCodes, badCodes] =
                uut.disabledDiagnosticsFromPassageTagLabels(tags);

            expect(disabledCodes).to.eql(
                new Set(["incorrect-javascript", "missing-passage"]),
            );
            expect(badCodes).to.eql([
                {
                    contents: "nope",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 34, 1, 38),
                    ),
                },
            ]);
        });
    });
});
