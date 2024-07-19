import { expect } from "chai";
import "mocha";
import { Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import * as uut from "../embedded-languages";

describe("Embedded Languages", () => {
    describe("Updating", () => {
        it("should update an embedded document whose parent has a larger version number", () => {
            const originalParent = TextDocument.create(
                "parent-uri",
                "parent lang",
                17,
                "Line 1\nLine 2!\nLine 3"
            );
            const changedParent = TextDocument.create(
                "parent-uri",
                "parent lang",
                18,
                "Line 1\nLine 2 - changed!\nLine 3"
            );
            const embeddedDocument = uut.EmbeddedDocument.create(
                "child-uri",
                "child lang",
                "Line 2!\nLine 3",
                7,
                originalParent
            );

            const result = uut.updateEmbeddedDocument(
                embeddedDocument,
                changedParent
            );

            expect(result).to.eql({
                document: TextDocument.create(
                    "child-uri",
                    "child lang",
                    18,
                    "Line 2 - changed!\nLine 3"
                ),
                range: Range.create(1, 0, 2, 6),
            });
        });

        it("should not update an embedded document whose parent has the same version number", () => {
            const originalParent = TextDocument.create(
                "parent-uri",
                "parent lang",
                17,
                "Line 1\nLine 2!\nLine 3"
            );
            const supposedlyChangedParent = TextDocument.create(
                "parent-uri",
                "parent lang",
                17,
                "Line 1\nLine 2 - changed!\nLine 3"
            );
            const embeddedDocument = uut.EmbeddedDocument.create(
                "child-uri",
                "child lang",
                "Line 2!\nLine 3",
                7,
                originalParent
            );

            const result = uut.updateEmbeddedDocument(
                embeddedDocument,
                supposedlyChangedParent
            );

            expect(result).to.eql({
                document: TextDocument.create(
                    "child-uri",
                    "child lang",
                    17,
                    "Line 2!\nLine 3"
                ),
                range: Range.create(1, 0, 2, 6),
            });
        });
    });
});
