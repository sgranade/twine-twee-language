import { expect } from "chai";
import "mocha";

import * as uut from "../utilities";
import { TextDocument } from "vscode-languageserver-textdocument";
import { Position, Range } from "vscode-languageserver";

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

    describe("remove padding", () => {
        it("should return the string without padding on the left and right", () => {
            // No arrange

            const [result] = uut.removeAndCountPadding(" \t No padding? ");

            expect(result).to.eql("No padding?");
        });

        it("should return the number of padding characters removed from the left", () => {
            // No arrange

            const [, result] = uut.removeAndCountPadding(
                " \t No left padding? "
            );

            expect(result).to.eql(3);
        });

        it("should return the number of padding characters removed from the right", () => {
            // No arrange

            const [, , result] = uut.removeAndCountPadding(
                " \t No left padding? "
            );

            expect(result).to.eql(1);
        });
    });

    describe("move past spaces", () => {
        it("should return the string without padding on the left and right", () => {
            // No arrange

            const [result] = uut.skipSpaces(" \t No padding? ", 17);

            expect(result).to.eql("No padding?");
        });

        it("should advance the passed index value by the padding amount", () => {
            // No arrange

            const [, result] = uut.skipSpaces(" \t No padding? ", 17);

            expect(result).to.eql(20);
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

    describe("containing position", () => {
        it("should find the position for a line-based embedded document", () => {
            const innerDoc = TextDocument.create(
                "inner-uri",
                "text",
                1,
                "Inner line 1\ninner line 2"
            );
            const outerDoc = TextDocument.create(
                "outer-uri",
                "text",
                1,
                "Outer line 1\nInner line 1\ninner line 2\nOuter line 4"
            );
            const innerDocOffset = outerDoc
                .getText()
                .indexOf(innerDoc.getText());

            const result = uut.containingPosition(
                innerDoc,
                Position.create(1, 7),
                outerDoc,
                innerDocOffset
            );

            expect(result).to.eql({ line: 2, character: 7 });
        });

        it("should find the position for a character-based embedded document", () => {
            const innerDoc = TextDocument.create(
                "inner-uri",
                "text",
                1,
                "{inner bit}"
            );
            const outerDoc = TextDocument.create(
                "outer-uri",
                "text",
                1,
                "Outer line 1\nOuter {inner bit} line 2"
            );
            const innerDocOffset = outerDoc
                .getText()
                .indexOf(innerDoc.getText());

            const result = uut.containingPosition(
                innerDoc,
                Position.create(0, 3),
                outerDoc,
                innerDocOffset
            );

            expect(result).to.eql({ line: 1, character: 9 });
        });
    });

    describe("containing range", () => {
        it("should find the range for a line-based embedded document", () => {
            const innerDoc = TextDocument.create(
                "inner-uri",
                "text",
                1,
                "Inner line 1\ninner line 2"
            );
            const outerDoc = TextDocument.create(
                "outer-uri",
                "text",
                1,
                "Outer line 1\nInner line 1\ninner line 2\nOuter line 4"
            );
            const innerDocOffset = outerDoc
                .getText()
                .indexOf(innerDoc.getText());

            const result = uut.containingRange(
                innerDoc,
                Range.create(0, 3, 1, 7),
                outerDoc,
                innerDocOffset
            );

            expect(result).to.eql({
                start: { line: 1, character: 3 },
                end: { line: 2, character: 7 },
            });
        });
    });
});
