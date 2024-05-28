import "mocha";
import { expect } from "chai";
import { Range } from "vscode-languageserver";

import { ETokenType } from "../../../../tokens";
import { MockCallbacks, buildParsingState } from "../../../builders";
import { ChapbookParsingState } from "../../../../passage-text-parsers/chapbook";
import { buildInsertTokens } from "./insert-builders";
import * as uut from "../../../../passage-text-parsers/chapbook/inserts/link";

describe("Link Insert", () => {
    it("should set a string token for a first argument that's a link", () => {
        const state = buildParsingState({});
        const chapbookState: ChapbookParsingState = {
            textSubsectionTokens: {},
            modifierType: 0,
        };
        const args = buildInsertTokens({
            firstArgument: "'https://google.com/'",
            firstArgumentAt: 17,
        });

        uut.link.parse(args, state, chapbookState);

        expect(chapbookState.textSubsectionTokens).to.eql({
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
            textSubsectionTokens: {},
            modifierType: 0,
        };
        const args = buildInsertTokens({
            firstArgument: '"Passage Ref"',
            firstArgumentAt: 17,
        });

        uut.link.parse(args, state, chapbookState);

        expect(chapbookState.textSubsectionTokens).to.eql({
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
            textSubsectionTokens: {},
            modifierType: 0,
        };
        const args = buildInsertTokens({
            firstArgument: '"Passage Ref"',
            firstArgumentAt: 10,
        });

        uut.link.parse(args, state, chapbookState);

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
            textSubsectionTokens: {},
            modifierType: 0,
        };
        const args = buildInsertTokens({
            firstArgument: '"Passage Ref"',
            firstArgumentAt: 10,
        });
        args.props = {
            label: [
                { text: "label", at: 0 },
                { text: '"Go!"', at: 32 },
            ],
        };

        uut.link.parse(args, state, chapbookState);
        const result = chapbookState.textSubsectionTokens[32];

        expect(result).to.eql({
            text: '"Go!"',
            at: 32,
            type: ETokenType.string,
            modifiers: [],
        });
    });
});
