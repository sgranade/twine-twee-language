import { expect } from "chai";
import "mocha";

import * as uut from "../utilities";

describe("Utilities", () => {
    describe("pairwise", () => {
        it("should yield iterable items in pairs", () => {
            const data = ["a", "b", "c"];

            const result = [...uut.pairwise(data)];

            expect(result).to.eql([
                ["a", "b"],
                ["b", "c"],
            ]);
        });

        it("should yield nothing if passed no contents", () => {
            const data: string[] = [];

            const result = [...uut.pairwise(data)];

            expect(result).to.be.empty;
        });
    });

    describe("next line index", () => {
        it("should find the next line after a \\n", () => {
            const text = "line1\nline2";

            const endLocation = uut.nextLineIndex(text, 0);

            expect(endLocation).to.equal(6);
        });

        it("should find the next line after a CRLF", () => {
            const text = "line1\r\nline2";

            const endLocation = uut.nextLineIndex(text, 0);

            expect(endLocation).to.equal(7);
        });

        it("should find the next line even in the middle of a string", () => {
            const text = "line1\r\nline2\r\nline3\r\n";

            const endLocation = uut.nextLineIndex(text, 7);

            expect(endLocation).to.equal(14);
        });
    });
});
