import { expect } from "chai";
import "mocha";
import { Diagnostic, Position, Range, TextEdit } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "@tt3/shared";
import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index } from "../project-index";
import { buildPassage, buildTag } from "./builders";

import * as uut from "../code-actions";

describe("Code Actions", () => {
    /**
     * Index a Twee document and get the code actions for a diagnostic on
     * its second line, which is inside the document's first passage.
     */
    function actionsInTwee(
        text: string,
        code: string = DiagnosticCodes.MissingPassage,
        source = "Twine",
    ) {
        const index = new Index();
        const tw = TextDocument.create("file:///story.tw", "twee3", 1, text);
        updateProjectIndex(tw, ParseLevel.Full, index);
        const diagnostic = Diagnostic.create(
            Range.create(1, 0, 1, 4),
            "error",
            undefined,
            code,
            source,
        );

        return uut.getCodeActionsAt(
            tw.uri,
            Position.create(1, 2),
            [diagnostic],
            index,
        );
    }

    describe("Passage Disabling Diagnostics", () => {
        it("should offer one action for a diagnostic in a Twee passage", () => {
            const result = actionsInTwee(":: passage\nSome text\n");

            expect(result.map((a) => a.title)).to.eql([
                "Disable missing-passage for this passage",
            ]);
        });

        it("should ignore non-Twine diagnostics", () => {
            const result = actionsInTwee(
                ":: passage\nSome text\n",
                DiagnosticCodes.MissingPassage,
                "other-source",
            );

            expect(result).to.be.empty;
        });

        it("should ignore diagnostics with unrecognized codes", () => {
            const result = actionsInTwee(
                ":: passage\nSome text\n",
                "fake-code",
            );

            expect(result).to.be.empty;
        });

        it("should create new passage tags if none exist", () => {
            const result = actionsInTwee(":: passage\nSome text\n");

            expect(result[0]?.edit?.changes?.["file:///story.tw"]).to.eql([
                TextEdit.insert(
                    Position.create(0, 10),
                    " [tt3-disable missing-passage]",
                ),
            ]);
        });

        it("should add passage tags if no disabling-specific ones exist", () => {
            const result = actionsInTwee(":: passage [first]\nSome text\n");

            expect(result[0]?.edit?.changes?.["file:///story.tw"]).to.eql([
                TextEdit.insert(
                    Position.create(0, 17),
                    " tt3-disable missing-passage",
                ),
            ]);
        });

        it("should add a diagnostic code tag if none exists", () => {
            const result = actionsInTwee(
                ":: passage [tt3-disable]\nSome text\n",
            );

            expect(result[0]?.edit?.changes?.["file:///story.tw"]).to.eql([
                TextEdit.insert(Position.create(0, 23), " missing-passage"),
            ]);
        });

        it("should append a diagnostic code to an existing diagnostic code tag", () => {
            const result = actionsInTwee(
                ":: passage [tt3-disable previous-code]\nSome text\n",
            );

            expect(result[0]?.edit?.changes?.["file:///story.tw"]).to.eql([
                TextEdit.insert(Position.create(0, 37), ",missing-passage"),
            ]);
        });

        it("should offer no actions for a diagnostic in a story script file", () => {
            const index = new Index();
            const script = TextDocument.create(
                "file:///s.js",
                "javascript",
                1,
                "State.variables.gold = 2;\n",
            );
            updateScriptFileIndex(
                script,
                "story-script",
                ParseLevel.Full,
                index,
            );
            const diagnostic = Diagnostic.create(
                Range.create(0, 0, 0, 5),
                "error",
                undefined,
                DiagnosticCodes.SugarCubeApiNotAvailable,
                "Twine",
            );

            const result = uut.getCodeActionsAt(
                script.uri,
                Position.create(0, 2),
                [diagnostic],
                index,
            );

            expect(result).to.be.empty;
        });
    });
});
