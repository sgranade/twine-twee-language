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

    it("should set semantic tokens for a set of properties", () => {
        const expression = " {prop1: val1, prop2: 'val2'}";
        const offset = 12;
        const state: PassageTextParsingState = {
            passageTokens: {},
        };

        uut.parseJSExpression(expression, offset, state);
        const result = state.passageTokens;

        expect(result[14]).to.eql({
            text: "prop1",
            at: 14,
            type: ETokenType.property,
            modifiers: [],
        });
        expect(result[21]).to.eql({
            text: "val1",
            at: 21,
            type: ETokenType.variable,
            modifiers: [],
        });
        expect(result[27]).to.eql({
            text: "prop2",
            at: 27,
            type: ETokenType.property,
            modifiers: [],
        });
        expect(result[34]).to.eql({
            text: "'val2'",
            at: 34,
            type: ETokenType.string,
            modifiers: [],
        });
    });
});