import { expect } from "chai";
import "mocha";
import { Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../project-index";
import { buildPassage } from "./builders";

import * as uut from "../completions";

describe("Completions", () => {
    describe("Links", () => {
        it("should suggest a passage just after a [[", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ ");
            const position = Position.create(0, 4);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 3, 0, 4),
                newText: "Testy",
            });
        });

        it("should suggest a replacement passage just after a [[", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 3, 0, 9),
                newText: "Testy",
            });
        });

        it("should not suggest a passage within a [[ ... |", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe |");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results).to.be.null;
        });

        it("should suggest a replacement passage just after a [[...|", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe | other passage \nother"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 11, 0, 26),
                newText: "Testy",
            });
        });

        it("should not suggest a passage within a [[ ... ->", async () => {
            const doc = TextDocument.create("fake-uri", "", 0, " [[ toupe ->");
            const position = Position.create(0, 5);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results).to.be.null;
        });

        it("should suggest a replacement passage just after a [[...->", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe -> other passage \nother"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 12, 0, 27),
                newText: "Testy",
            });
        });

        it("should suggest a passage replacement within the limits of [[ ... ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ replace all of this ]] but not this"
            );
            const position = Position.create(0, 4);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 3, 0, 24),
                newText: "Testy",
            });
        });

        it("should suggest a replacement passage within [[...| here ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe | replace this ]] but not this"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 11, 0, 25),
                newText: "Testy",
            });
        });

        it("should suggest a replacement passage within [[...-> here ]]", async () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                " [[ toupe -> other passage ]] not here"
            );
            const position = Position.create(0, 19);
            const index = new Index();
            index.setPassages("fake-uri", [buildPassage({ label: "Testy" })]);

            const results = await uut.generateCompletions(doc, position, index);

            expect(results?.items.length).to.equal(1);
            expect(results?.items[0].textEdit).to.eql({
                range: Range.create(0, 12, 0, 27),
                newText: "Testy",
            });
        });
    });
});
