import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Range } from "vscode-languageserver";

import { ETokenType } from "../../../../tokens";
import { MockCallbacks, buildParsingState } from "../../../builders";
import { ChapbookParsingState } from "../../../../passage-text-parsers/chapbook/chapbook-parser";
import { buildInsertTokens } from "./insert-builders";
import { Token } from "../../../../passage-text-parsers/chapbook/inserts";
import * as uutEmbedPassage from "../../../../passage-text-parsers/chapbook/inserts/embed-passage";
import * as uutLink from "../../../../passage-text-parsers/chapbook/inserts/link";
import * as uutRevealLink from "../../../../passage-text-parsers/chapbook/inserts/reveal-link";

describe("Inserts", () => {
    describe("Embed Passage", () => {
        it("should set a class token for a first argument that's a passage", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{embed passage: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: '"Passage Ref"',
                firstArgumentAt: 17,
            });

            uutEmbedPassage.embedPassage.parse(args, state, chapbookState);

            expect(chapbookState.passageTokens).to.eql({
                18: {
                    text: "Passage Ref",
                    at: 18,
                    type: ETokenType.class,
                    modifiers: [],
                },
            });
        });

        it("should capture the passage reference for the first argument", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{embed passage: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: '"Passage Ref"',
                firstArgumentAt: 10,
            });

            uutEmbedPassage.embedPassage.parse(args, state, chapbookState);

            expect(callbacks.passageReferences).to.eql({
                "Passage Ref": [Range.create(0, 11, 0, 22)],
            });
        });

        it("should log an error for a non-string first argument", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: "{embed passage: Passage Ref}",
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: "Passage Ref",
                firstArgumentAt: 10,
            });

            uutEmbedPassage.embedPassage.parse(args, state, chapbookState);

            expect(callbacks.errors.length).to.equal(1);
            expect(callbacks.errors[0].message).to.include("Must be a string");
            expect(callbacks.errors[0].range).to.eql(
                Range.create(0, 10, 0, 21)
            );
        });
    });

    describe("Link", () => {
        it("should set a string token for a first argument that's a link", () => {
            const state = buildParsingState({});
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: "'https://google.com/'",
                firstArgumentAt: 17,
            });

            uutLink.link.parse(args, state, chapbookState);

            expect(chapbookState.passageTokens).to.eql({
                17: {
                    text: "'https://google.com/'",
                    at: 17,
                    type: ETokenType.string,
                    modifiers: [],
                },
            });
        });

        it("should set a class token for a first argument that's a passage", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{link to: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: '"Passage Ref"',
                firstArgumentAt: 17,
            });

            uutLink.link.parse(args, state, chapbookState);

            expect(chapbookState.passageTokens).to.eql({
                18: {
                    text: "Passage Ref",
                    at: 18,
                    type: ETokenType.class,
                    modifiers: [],
                },
            });
        });

        it("should capture the passage reference for a first argument that's a passage", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{link to: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: '"Passage Ref"',
                firstArgumentAt: 10,
            });

            uutLink.link.parse(args, state, chapbookState);

            expect(callbacks.passageReferences).to.eql({
                "Passage Ref": [Range.create(0, 11, 0, 22)],
            });
        });

        it("should set a string token for a label property", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{link to: "Passage Ref", label: "Go!"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({
                firstArgument: '"Passage Ref"',
                firstArgumentAt: 10,
            });
            args.props = {
                label: [Token.create("label", 0), Token.create('"Go!"', 32)],
            };

            uutLink.link.parse(args, state, chapbookState);
            const result = chapbookState.passageTokens[32];

            expect(result).to.eql({
                text: '"Go!"',
                at: 32,
                type: ETokenType.string,
                modifiers: [],
            });
        });
    });

    describe("Reveal Link", () => {
        it("should flag the insert if neither text nor passage properties are set", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: "{reveal link}",
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({ name: "reveal link", nameAt: 1 });

            uutRevealLink.revealLink.parse(args, state, chapbookState);
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.severity).to.eql(DiagnosticSeverity.Error);
            expect(result.message).to.include(
                'Either the "passage" or "text" property must be defined'
            );
            expect(result.range).to.eql(Range.create(0, 1, 0, 12));
        });

        it("should warn if both text and passage properties are set", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{reveal link, text: "text!", passage: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({});
            args.props = {
                text: [Token.create("text", 14), Token.create('"text!"', 20)],
                passage: [
                    Token.create("passage", 29),
                    Token.create('"Passage Ref"', 38),
                ],
            };

            uutRevealLink.revealLink.parse(args, state, chapbookState);
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.severity).to.eql(DiagnosticSeverity.Warning);
            expect(result.message).to.include(
                'The "passage" property will be ignored'
            );
            expect(result.range).to.eql(Range.create(0, 29, 0, 36));
        });

        it("should create a passage reference for the passage property", () => {
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: '{reveal link, passage: "Passage Ref"}',
                callbacks: callbacks,
            });
            const chapbookState: ChapbookParsingState = {
                passageTokens: {},
                modifierType: 0,
            };
            const args = buildInsertTokens({});
            args.props = {
                passage: [
                    Token.create("passage", 14),
                    Token.create('"Passage Ref"', 23),
                ],
            };

            uutRevealLink.revealLink.parse(args, state, chapbookState);

            expect(callbacks.passageReferences).to.eql({
                "Passage Ref": [Range.create(0, 24, 0, 35)],
            });
        });
    });
});
