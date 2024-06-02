import { expect } from "chai";
import "mocha";

import { ETokenType } from "../tokens";
import { PassageTextParsingState } from "../passage-text-parsers";
import * as uut from "../js-parser";

describe("JS Parser", () => {
    it("should set a semantic token for a numeric value", () => {
        const expression = "17";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result).to.eql({
            12: {
                text: "17",
                at: 12,
                type: ETokenType.number,
                modifiers: [],
            },
        });
    });

    it("should set a semantic token for a string value", () => {
        const expression = "'hiya'";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result).to.eql({
            12: {
                text: "'hiya'",
                at: 12,
                type: ETokenType.string,
                modifiers: [],
            },
        });
    });

    it("should set a semantic token for a boolean value", () => {
        const expression = "true";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result).to.eql({
            12: {
                text: "true",
                at: 12,
                type: ETokenType.keyword,
                modifiers: [],
            },
        });
    });

    it("should set a semantic token for an assignment operator", () => {
        const expression = " var +=";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[17]).to.eql({
            text: "+=",
            at: 17,
            type: ETokenType.operator,
            modifiers: [],
        });
    });

    it("should set a semantic token for a binary operator", () => {
        const expression = " 1 +";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[15]).to.eql({
            text: "+",
            at: 15,
            type: ETokenType.operator,
            modifiers: [],
        });
    });

    it("should set a semantic token for a logical operator", () => {
        const expression = " var ||";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[17]).to.eql({
            text: "||",
            at: 17,
            type: ETokenType.operator,
            modifiers: [],
        });
    });

    it("should set a semantic token for a function call", () => {
        const expression = " func(true)";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[13]).to.eql({
            text: "func",
            at: 13,
            type: ETokenType.function,
            modifiers: [],
        });
    });

    it("should set a semantic token for an (apparent) variable", () => {
        const expression = " var1";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[13]).to.eql({
            text: "var1",
            at: 13,
            type: ETokenType.variable,
            modifiers: [],
        });
    });

    it("should set a semantic token for a property", () => {
        const expression = " var1.prop";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[18]).to.eql({
            text: "prop",
            at: 18,
            type: ETokenType.property,
            modifiers: [],
        });
    });

    it("should set a semantic token for a computed property", () => {
        const expression = " var1[prop]";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[18]).to.eql({
            text: "prop",
            at: 18,
            type: ETokenType.variable,
            modifiers: [],
        });
    });
});
