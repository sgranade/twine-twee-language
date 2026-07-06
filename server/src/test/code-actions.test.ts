import { expect } from "chai";
import "mocha";
import {
    Diagnostic,
    Location,
    Position,
    Range,
    TextEdit,
} from "vscode-languageserver";

import { DiagnosticCodes, DisableDiagnosticTag } from "../diagnostics";
import { buildPassage, buildTag } from "./builders";

import * as uut from "../code-actions";

describe("Code Actions", () => {
    describe("Passage Disabling Diagnostics", () => {
        it("should ignore non-Twine diagnostics", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                DiagnosticCodes.MissingPassage,
                "other-source",
            );

            const result = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);

            expect(result).to.be.empty;
        });

        it("should ignore diagnostics with unrecognized codes", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                "fake-code",
                "Twine",
            );

            const result = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);

            expect(result).to.be.empty;
        });

        it("should create new passage tags if none exist", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                DiagnosticCodes.MissingPassage,
                "Twine",
            );

            const actions = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);
            const result = actions.find((action) =>
                action.title.includes(
                    `Disable ${DiagnosticCodes.MissingPassage} for this passage`,
                ),
            );

            expect(result?.edit?.changes?.["fake-uri"]).to.eql([
                TextEdit.insert(
                    Position.create(1, 8),
                    ` [${DisableDiagnosticTag} ${DiagnosticCodes.MissingPassage}]`,
                ),
            ]);
        });

        it("should add passage tags if no disabling-specific ones exist", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            passage.tags = [
                buildTag(
                    "first",
                    Location.create("fake-uri", Range.create(1, 11, 1, 16)),
                ),
            ];
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                DiagnosticCodes.MissingPassage,
                "Twine",
            );

            const actions = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);
            const result = actions.find((action) =>
                action.title.includes(
                    `Disable ${DiagnosticCodes.MissingPassage} for this passage`,
                ),
            );

            expect(result?.edit?.changes?.["fake-uri"]).to.eql([
                TextEdit.insert(
                    Position.create(1, 16),
                    ` ${DisableDiagnosticTag} ${DiagnosticCodes.MissingPassage}`,
                ),
            ]);
        });

        it("should add a diagnostic code tag if none exists", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            passage.tags = [
                buildTag(
                    DisableDiagnosticTag,
                    Location.create("fake-uri", Range.create(1, 11, 1, 34)),
                ),
            ];
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                DiagnosticCodes.MissingPassage,
                "Twine",
            );

            const actions = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);
            const result = actions.find((action) =>
                action.title.includes(
                    `Disable ${DiagnosticCodes.MissingPassage} for this passage`,
                ),
            );

            expect(result?.edit?.changes?.["fake-uri"]).to.eql([
                TextEdit.insert(
                    Position.create(1, 34),
                    ` ${DiagnosticCodes.MissingPassage}`,
                ),
            ]);
        });

        it("should append a diagnostic code to an existing diagnostic code tag", () => {
            const passage = buildPassage({
                label: "passage",
                location: {
                    uri: "fake-uri",
                    range: Range.create(1, 1, 1, 8),
                },
            });
            passage.tags = [
                buildTag(
                    DisableDiagnosticTag,
                    Location.create("fake-uri", Range.create(1, 11, 1, 22)),
                ),
                buildTag(
                    "previous-code",
                    Location.create("fake-uri", Range.create(1, 24, 1, 37)),
                ),
            ];
            const diagnostic = Diagnostic.create(
                Range.create(2, 3, 2, 5),
                "error",
                undefined,
                DiagnosticCodes.MissingPassage,
                "Twine",
            );

            const actions = uut.generateCodeActions("fake-uri", passage, [
                diagnostic,
            ]);
            const result = actions.find((action) =>
                action.title.includes(
                    `Disable ${DiagnosticCodes.MissingPassage} for this passage`,
                ),
            );

            expect(result?.edit?.changes?.["fake-uri"]).to.eql([
                TextEdit.insert(
                    Position.create(1, 37),
                    `,${DiagnosticCodes.MissingPassage}`,
                ),
            ]);
        });
    });
});
