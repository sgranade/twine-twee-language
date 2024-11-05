import "mocha";
import { expect } from "chai";
import { Location, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormatParsingState } from "../../../../passage-text-parsers";
import { ETokenType } from "../../../../semantic-tokens";
import * as uut from "../../../../passage-text-parsers/sugarcube/sc2/sc2-twinescript";

describe("SugarCube TwineScript", () => {
    describe("desugar", () => {
        it("should desugar variable sigils", () => {
            // Arrange

            const result = uut.desugar("First $permanent then _temp");

            expect(result.desugared).to.eql("First Xpermanent then Xtemp");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 6,
                    originalString: "$",
                    newStart: 6,
                    newEnd: 7,
                },
                {
                    originalStart: 22,
                    originalString: "_",
                    newStart: 22,
                    newEnd: 23,
                },
            ]);
        });

        it("should desugar the assignment operator", () => {
            // Arrange

            const result = uut.desugar("$var to 17");

            expect(result.desugared).to.eql("Xvar = 17");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 0,
                    originalString: "$",
                    newStart: 0,
                    newEnd: 1,
                },
                {
                    originalStart: 5,
                    originalString: "to",
                    newStart: 5,
                    newEnd: 6,
                },
            ]);
        });

        it("should desugar equality operators", () => {
            // Arrange

            const result = uut.desugar("(((1 eq 2) neq 3) is 4) isnot 5");

            expect(result.desugared).to.eql("(((1 == 2) != 3) === 4) !== 5");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 5,
                    originalString: "eq",
                    newStart: 5,
                    newEnd: 7,
                },
                {
                    originalStart: 11,
                    originalString: "neq",
                    newStart: 11,
                    newEnd: 13,
                },
                {
                    originalStart: 18,
                    originalString: "is",
                    newStart: 17,
                    newEnd: 20,
                },
                {
                    originalStart: 24,
                    originalString: "isnot",
                    newStart: 24,
                    newEnd: 27,
                },
            ]);
        });

        it("should desugar relational operators", () => {
            // Arrange

            const result = uut.desugar("(((1 gt 2) gte 3) lt 4) lte 5");

            expect(result.desugared).to.eql("(((1 > 2) >= 3) < 4) <= 5");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 5,
                    originalString: "gt",
                    newStart: 5,
                    newEnd: 6,
                },
                {
                    originalStart: 11,
                    originalString: "gte",
                    newStart: 10,
                    newEnd: 12,
                },
                {
                    originalStart: 18,
                    originalString: "lt",
                    newStart: 16,
                    newEnd: 17,
                },
                {
                    originalStart: 24,
                    originalString: "lte",
                    newStart: 21,
                    newEnd: 23,
                },
            ]);
        });

        it("should desugar logical operators", () => {
            // Arrange

            const result = uut.desugar("(true or false) and true");

            expect(result.desugared).to.eql("(true || false) && true");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 6,
                    originalString: "or",
                    newStart: 6,
                    newEnd: 8,
                },
                {
                    originalStart: 16,
                    originalString: "and",
                    newStart: 16,
                    newEnd: 18,
                },
            ]);
        });

        it("should desugar unary operators", () => {
            // Arrange

            const result = uut.desugar("not false && def var1 && ndef var2");

            expect(result.desugared).to.eql("! false && ! var1 && ! var2");
            expect(result.positionMapping).to.eql([
                {
                    originalStart: 0,
                    originalString: "not",
                    newStart: 0,
                    newEnd: 1,
                },
                {
                    originalStart: 13,
                    originalString: "def",
                    newStart: 11,
                    newEnd: 12,
                },
                {
                    originalStart: 25,
                    originalString: "ndef",
                    newStart: 21,
                    newEnd: 22,
                },
            ]);
        });

        it("should not desugar anything in quote marks", () => {
            // Arrange

            const result = uut.desugar("1 \"to\" 2 'eq' 3");

            expect(result.desugared).to.eql("1 \"to\" 2 'eq' 3");
            expect(result.positionMapping).to.be.empty;
        });
    });

    describe("is TwineScript", () => {
        it("should return true for bare variables", () => {
            // No arrange

            const result = uut.isTwineScriptExpression("$bare_var");

            expect(result).to.be.true;
        });

        it("should return false for bare words", () => {
            // No arrange

            const result = uut.isTwineScriptExpression("bareWord");

            expect(result).to.be.false;
        });

        it("should return false for several bare words", () => {
            // No arrange

            const result = uut.isTwineScriptExpression("bare word number 2");

            expect(result).to.be.false;
        });

        it("should return true for a complex TwineScript expression", () => {
            // No arrange

            const result = uut.isTwineScriptExpression(
                '$var to (17 + 23) - "text"'
            );

            expect(result).to.be.true;
        });
    });

    describe("tokenize TwineScript", () => {
        it("should set semantic tokens for variable assignment", () => {
            const expression = "$varbl to 'testy'";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript: ${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );
            const result = storyState.passageTokens;

            expect(result).to.eql({
                13: {
                    text: "$varbl",
                    at: 13,
                    type: ETokenType.variable,
                    modifiers: [],
                },
                20: {
                    text: "to",
                    at: 20,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                23: {
                    text: "'testy'",
                    at: 23,
                    type: ETokenType.string,
                    modifiers: [],
                },
            });
        });

        it("should return apparent variables for variable assignment", () => {
            const expression = "$varbl to 'testy'";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript:\n${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );

            expect(result[0]).to.eql([
                {
                    contents: "$varbl",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 0, 1, 6)
                    ),
                },
            ]);
            expect(result[1]).to.be.empty;
        });

        it("should return apparent properties for variable assignment", () => {
            const expression = "$varbl.rootprop1.rootprop2 to 'testy'";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript:\n${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );

            expect(result[1]).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 16)
                    ),
                    scope: "$varbl",
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 26)
                    ),
                    scope: "$varbl.rootprop1",
                },
            ]);
        });

        it("should set semantic tokens for equality operators", () => {
            const expression = "(((1 eq 2) neq 3) is 4) isnot 5";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript: ${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );
            const result = storyState.passageTokens;

            expect(result).to.eql({
                16: {
                    text: "1",
                    at: 16,
                    type: ETokenType.number,
                    modifiers: [],
                },
                18: {
                    text: "eq",
                    at: 18,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                21: {
                    text: "2",
                    at: 21,
                    type: ETokenType.number,
                    modifiers: [],
                },
                24: {
                    text: "neq",
                    at: 24,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                28: {
                    text: "3",
                    at: 28,
                    type: ETokenType.number,
                    modifiers: [],
                },
                31: {
                    text: "is",
                    at: 31,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                34: {
                    text: "4",
                    at: 34,
                    type: ETokenType.number,
                    modifiers: [],
                },
                37: {
                    text: "isnot",
                    at: 37,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                43: {
                    text: "5",
                    at: 43,
                    type: ETokenType.number,
                    modifiers: [],
                },
            });
        });

        it("should set semantic tokens for relational operators", () => {
            const expression = "(((1 gt 2) gte 3) lt 4) lte 5";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript: ${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );
            const result = storyState.passageTokens;

            expect(result).to.eql({
                16: {
                    text: "1",
                    at: 16,
                    type: ETokenType.number,
                    modifiers: [],
                },
                18: {
                    text: "gt",
                    at: 18,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                21: {
                    text: "2",
                    at: 21,
                    type: ETokenType.number,
                    modifiers: [],
                },
                24: {
                    text: "gte",
                    at: 24,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                28: {
                    text: "3",
                    at: 28,
                    type: ETokenType.number,
                    modifiers: [],
                },
                31: {
                    text: "lt",
                    at: 31,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                34: {
                    text: "4",
                    at: 34,
                    type: ETokenType.number,
                    modifiers: [],
                },
                37: {
                    text: "lte",
                    at: 37,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                41: {
                    text: "5",
                    at: 41,
                    type: ETokenType.number,
                    modifiers: [],
                },
            });
        });

        it("should set semantic tokens for logical operators", () => {
            const expression = "(_varbl or false) and true";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript: ${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );
            const result = storyState.passageTokens;

            expect(result).to.eql({
                14: {
                    text: "_varbl",
                    at: 14,
                    type: ETokenType.variable,
                    modifiers: [],
                },
                21: {
                    text: "or",
                    at: 21,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                24: {
                    text: "false",
                    at: 24,
                    type: ETokenType.keyword,
                    modifiers: [],
                },
                31: {
                    text: "and",
                    at: 31,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                35: {
                    text: "true",
                    at: 35,
                    type: ETokenType.keyword,
                    modifiers: [],
                },
            });
        });

        it("should set semantic tokens for unary operators", () => {
            const expression = "not $varbl && def _var1 && ndef $var2";
            const offset = 13;
            const textDocument = TextDocument.create(
                "fake-uri",
                "twine",
                1,
                `twinescript: ${expression}`
            );
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeTwineScriptExpression(
                expression,
                offset,
                textDocument,
                storyState
            );
            const result = storyState.passageTokens;

            expect(result).to.eql({
                13: {
                    text: "not",
                    at: 13,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                17: {
                    text: "$varbl",
                    at: 17,
                    type: ETokenType.variable,
                    modifiers: [],
                },
                24: {
                    text: "&&",
                    at: 24,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                27: {
                    text: "def",
                    at: 27,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                31: {
                    text: "_var1",
                    at: 31,
                    type: ETokenType.variable,
                    modifiers: [],
                },
                37: {
                    text: "&&",
                    at: 37,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                40: {
                    text: "ndef",
                    at: 40,
                    type: ETokenType.operator,
                    modifiers: [],
                },
                45: {
                    text: "$var2",
                    at: 45,
                    type: ETokenType.variable,
                    modifiers: [],
                },
            });
        });
    });
});
