import { expect } from "chai";
import "mocha";
import { Diagnostic, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import { getLanguageService as getJSONLanguageService } from "vscode-json-languageservice";

import { EmbeddedJSONDocument, Index } from "../index";
import * as uut from "../validator";

describe("Validator", () => {
    describe("Parse Error", () => {
        it("should return parse errors from the index", async () => {
            const errors = [
                Diagnostic.create(
                    Range.create(1, 1, 2, 2),
                    "Your passage names aren't great"
                ),
                Diagnostic.create(
                    Range.create(3, 3, 4, 4),
                    "I question your choice of variables"
                ),
            ];
            const doc = TextDocument.create(
                "test-uri",
                "Twine",
                1.0,
                "Placeholder content"
            );
            const index = new Index();
            index.setParseErrors("test-uri", errors);

            const result = await uut.generateDiagnostics(doc, index);

            expect(result).to.eql(errors);
        });
    });

    describe("Embedded Documents", () => {
        it("should return parse errors from embedded JSON documents", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const embeddedDocument = TextDocument.create(
                "file:///fake.json",
                "json",
                1,
                document.getText()
            );
            const embeddedJSONDocument: EmbeddedJSONDocument = {
                position: Position.create(2, 0),
                document: document,
                jsonDocument: getJSONLanguageService({}).parseJSONDocument(
                    embeddedDocument
                ),
            };
            const index = new Index();
            index.setEmbeddedJSONDocuments("test-uri", [embeddedJSONDocument]);

            const result = await uut.generateDiagnostics(document, index);

            expect(result.length).to.equal(1);
            expect(result[0].message).to.equal("Trailing comma");
        });

        it("should offset embedded JSON document errors by its position in the larger document", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const embeddedDocument = TextDocument.create(
                "file:///fake.json",
                "json",
                1,
                document.getText()
            );
            const embeddedJSONDocument: EmbeddedJSONDocument = {
                position: Position.create(2, 0),
                document: document,
                jsonDocument: getJSONLanguageService({}).parseJSONDocument(
                    embeddedDocument
                ),
            };
            const index = new Index();
            index.setEmbeddedJSONDocuments("test-uri", [embeddedJSONDocument]);

            const result = await uut.generateDiagnostics(document, index);

            expect(result[0].message).to.equal("Trailing comma");
        });
    });
});
