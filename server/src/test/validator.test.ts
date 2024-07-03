import { expect } from "chai";
import "mocha";
import { Diagnostic, Location, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../embedded-languages";
import { Index } from "../project-index";
import * as uut from "../validator";
import { buildPassage } from "./builders";
import { defaultDiagnosticsOptions } from "../server-options";

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

            const result = await uut.generateDiagnostics(
                doc,
                index,
                defaultDiagnosticsOptions
            );

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
            const subDocument = TextDocument.create(
                "file:///fake.json",
                "json",
                1,
                document.getText()
            );
            const embeddedDocument: EmbeddedDocument = {
                document: subDocument,
                offset: 17,
            };
            const index = new Index();
            index.setEmbeddedDocuments("test-uri", [embeddedDocument]);

            const result = await uut.generateDiagnostics(
                document,
                index,
                defaultDiagnosticsOptions
            );

            expect(result.length).to.equal(1);
            expect(result[0].message).to.equal("Trailing comma");
        });

        it("should offset embedded JSON document errors by its position in the larger document", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '012345678\n0123456{ "test": 17, }'
            );
            const subDocument = TextDocument.create(
                "file:///fake.json",
                "json",
                1,
                '{ "test": 17, }'
            );
            const embeddedDocument: EmbeddedDocument = {
                document: subDocument,
                offset: 17,
            };
            const index = new Index();
            index.setEmbeddedDocuments("test-uri", [embeddedDocument]);

            const result = await uut.generateDiagnostics(
                document,
                index,
                defaultDiagnosticsOptions
            );

            expect(result[0].range).to.eql(Range.create(1, 19, 1, 20));
        });
    });

    describe("Passages", () => {
        it("should warn on repeated passage names in the same document", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const passages = [
                buildPassage({
                    label: "Passage 1a",
                    location: Location.create(
                        "test-uri",
                        Range.create(1, 1, 2, 3)
                    ),
                }),
                buildPassage({ label: "Passage 1b" }),
                buildPassage({
                    label: "Passage 1a",
                    location: Location.create(
                        "test-uri",
                        Range.create(4, 4, 5, 5)
                    ),
                }),
            ];
            const index = new Index();
            index.setPassages("test-uri", passages);

            const result = await uut.generateDiagnostics(
                document,
                index,
                defaultDiagnosticsOptions
            );

            expect(result.length).to.equal(2);
            expect(result[0].message).to.contain(
                'Passage "Passage 1a" was defined elsewhere'
            );
            expect(result[0].relatedInformation).to.not.be.undefined;
            if (result[0].relatedInformation !== undefined) {
                expect(result[0].relatedInformation[0].location).to.eql(
                    Location.create("test-uri", Range.create(4, 4, 5, 5))
                );
            }
            expect(result[1].message).to.contain(
                'Passage "Passage 1a" was defined elsewhere'
            );
            expect(result[1].relatedInformation).to.not.be.undefined;
            if (result[1].relatedInformation !== undefined) {
                expect(result[1].relatedInformation[0].location).to.eql(
                    Location.create("test-uri", Range.create(1, 1, 2, 3))
                );
            }
        });

        it("should warn on repeated passage names across documents", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const passages1 = [
                buildPassage({ label: "Passage 1a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "uri-one",
                        Range.create(1, 1, 2, 3)
                    ),
                }),
            ];
            const passages2 = [
                buildPassage({ label: "Passage 2a" }),
                buildPassage({
                    label: "Passage 1b",
                    location: Location.create(
                        "test-uri",
                        Range.create(4, 4, 5, 5)
                    ),
                }),
            ];
            const index = new Index();
            index.setPassages("uri-one", passages1);
            index.setPassages("test-uri", passages2);

            const result = await uut.generateDiagnostics(
                document,
                index,
                defaultDiagnosticsOptions
            );

            expect(result.length).to.equal(1);
            expect(result[0].message).to.contain(
                'Passage "Passage 1b" was defined elsewhere'
            );
            expect(result[0].relatedInformation).to.not.be.undefined;
            if (result[0].relatedInformation !== undefined) {
                expect(result[0].relatedInformation[0].location).to.eql(
                    Location.create("uri-one", Range.create(1, 1, 2, 3))
                );
            }
        });
    });

    describe("Passage References", () => {
        it("should flag passage references that aren't in the index", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const index = new Index();
            index.setPassageReferences("test-uri", {
                "Non-existent passage": [Range.create(1, 2, 3, 4)],
            });

            const result = await uut.generateDiagnostics(
                document,
                index,
                defaultDiagnosticsOptions
            );

            expect(result.length).to.equal(1);
            expect(result[0].message).to.contain(
                "Cannot find passage 'Non-existent passage'"
            );
        });

        it("should not flag passage references that aren't in the index if that warning is disabled in options", async () => {
            const document = TextDocument.create(
                "test-uri",
                "twine",
                1,
                '{ "test": 17, }'
            );
            const index = new Index();
            index.setPassageReferences("test-uri", {
                "Non-existent passage": [Range.create(1, 2, 3, 4)],
            });

            const result = await uut.generateDiagnostics(document, index, {
                warnings: { unknownMacro: true, unknownPassage: false },
            });

            expect(result).to.be.empty;
        });
    });
});
