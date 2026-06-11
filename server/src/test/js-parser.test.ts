import { expect } from "chai";
import "mocha";
import { Location, Range } from "vscode-languageserver";

import { buildParsingState, MockCallbacks } from "./builders";
import { ETokenType } from "../semantic-tokens";
import { StoryFormatParsingState } from "../passage-text-parsers";
import * as uut from "../js-parser";

describe("JS Parser", () => {
    describe("Semantic Tokens", () => {
        it("should set a semantic token for a numeric value", () => {
            const expression = "17";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[13]).to.eql({
                text: "var1",
                at: 13,
                type: ETokenType.variable,
                modifiers: [],
            });
        });

        it("should set a semantic token for a variable declaration", () => {
            const expression = " let var1 = 7;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[13]).to.eql({
                text: "let",
                at: 13,
                type: ETokenType.keyword,
                modifiers: [],
            });
            expect(result[17]).to.eql({
                text: "var1",
                at: 17,
                type: ETokenType.variable,
                modifiers: [],
            });
            expect(result[24]).to.eql({
                text: "7",
                at: 24,
                type: ETokenType.number,
                modifiers: [],
            });
        });

        it("should set a semantic token for a property", () => {
            const expression = " var1.prop";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[18]).to.eql({
                text: "prop",
                at: 18,
                type: ETokenType.property,
                modifiers: [],
            });
        });

        it("should set a semantic token for a property of a property", () => {
            const expression = " var1.prop1.prop2";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[18]).to.eql({
                text: "prop1",
                at: 18,
                type: ETokenType.property,
                modifiers: [],
            });
            expect(result[24]).to.eql({
                text: "prop2",
                at: 24,
                type: ETokenType.property,
                modifiers: [],
            });
        });

        it("should set a semantic token for a computed property", () => {
            const expression = " var1[prop]";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[18]).to.eql({
                text: "prop",
                at: 18,
                type: ETokenType.variable,
                modifiers: [],
            });
        });

        it("should set a semantic token for a member function", () => {
            const expression = " var1.func()";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

            expect(result[18]).to.eql({
                text: "func",
                at: 18,
                type: ETokenType.function,
                modifiers: [],
            });
        });

        it("should set semantic tokens for a set of properties", () => {
            const expression = " {prop1: val1, prop2: 'val2'}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "fake content",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );
            const result = storyState.passageTokens;

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

    describe("Returned Variables", () => {
        it("should return apparent variables in simple statements", () => {
            const expression = " var1 = 17;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = 17",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.variables).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
            ]);
            expect(result.properties).to.be.empty;
        });

        it("should return apparent variables in simple statements as being set if forced to", () => {
            const expression = " var1 = 17;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = 17",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
                true, // Force assignment to be definition
            );

            expect(result.variables).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: true,
                },
            ]);
            expect(result.properties).to.be.empty;
        });

        it("should return apparent variables in object assignments", () => {
            const expression = " var1 = {prop1: val1, prop2: 'val2'}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = {prop1: val1, prop2: 'val2'}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
                {
                    contents: "val1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 21),
                    ),
                    defined: false,
                },
            ]);
        });

        it("should return apparent variables in complex statements", () => {
            const expression = " var1['prop'] = {prop1: val1, prop2: 'val2'}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content:
                    "0123456789\n1 var1['prop'] = {prop1: val1, prop2: 'val2'}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
                {
                    contents: "val1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 25, 1, 29),
                    ),
                    defined: false,
                },
            ]);
        });

        it("should return apparent variables in assignment statements with dynamic computed properties", () => {
            const expression = " var1[var2] = 1";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1[var2] = 1",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
                {
                    contents: "var2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 11),
                    ),
                    defined: false,
                },
            ]);
        });

        it("should return properties that trace back to a root variable", () => {
            const expression =
                " var1.rootprop1.rootprop2 = {prop1: val1, prop2: 'val2'}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content:
                    "0123456789\n1 var1.rootprop1.rootprop2 = {prop1: val1, prop2: 'val2'}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 16),
                    ),
                    prefix: "var1",
                    defined: true,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 26),
                    ),
                    prefix: "var1.rootprop1",
                    defined: true,
                },
                {
                    contents: "prop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 30, 1, 35),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    defined: true,
                },
                {
                    contents: "prop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 43, 1, 48),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    defined: true,
                },
            ]);
        });

        it("should return properties that trace back to a root variable with a static computed property", () => {
            const expression =
                ' var1["rootprop1"].rootprop2 = {prop1: val1, prop2: "val2"}';
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content:
                    '0123456789\n1 var1["rootprop1"].rootprop2 = {prop1: val1, prop2: "val2"}',
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 8, 1, 17),
                    ),
                    prefix: "var1",
                    defined: true,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 20, 1, 29),
                    ),
                    prefix: "var1.rootprop1",
                    defined: true,
                },
                {
                    contents: "prop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 33, 1, 38),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    defined: true,
                },
                {
                    contents: "prop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 46, 1, 51),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    defined: true,
                },
            ]);
        });

        it("should return properties that trace back to a root variable that are before a computed property", () => {
            const expression =
                ' var1.rootprop1[var2].rootprop2 = {prop1: val1, prop2: "val2"}';
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content:
                    '0123456789\n var1.rootprop1[var2].rootprop2 = {prop1: val1, prop2: "val2"}',
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 16),
                    ),
                    prefix: "var1",
                    defined: true,
                },
            ]);
        });

        it("should return apparent properties that trace back to a root variable even in fragments", () => {
            const expression = " var1.rootprop1.rootprop2";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1.rootprop1.rootprop2",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 16),
                    ),
                    prefix: "var1",
                    defined: false,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 26),
                    ),
                    prefix: "var1.rootprop1",
                    defined: false,
                },
            ]);
        });

        it("should not return an instantiated class as a variable", () => {
            const expression = " var1 = new Error();";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = new Error();",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
            ]);
        });

        it("should not return properties from a LHS expression", () => {
            const expression = ' {prop1: "invalid"} = 17';
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: '0123456789\n1 {prop1: "invalid"} = 17;',
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.be.empty;
        });

        it("should not return properties on a built-in JavaScript object", () => {
            const expression = " Number.EPSILON";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 Number.EPSILON",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.be.empty;
        });

        it("should return properties whose names match those of a built-in JavaScript object's instance property", () => {
            const expression = " var1.length";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1.length",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.eql([
                {
                    contents: "length",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 13),
                    ),
                    prefix: "var1",
                    defined: false,
                },
            ]);
        });

        it("should not return a called function as a variable", () => {
            const expression = " var1 = funcme();";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = funcme();",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
            ]);
        });

        it("should not return a member function called on a variables as a property", () => {
            const expression = " var1 = var2.funcme();";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1 = var2.funcme();",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.variables).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
                {
                    contents: "var2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 9, 1, 13),
                    ),
                    defined: false,
                },
            ]);
            expect(result.properties).to.be.empty;
        });

        it("should not return a read/write variable assignment as a created variable", () => {
            const expression = " var1++;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 var1++",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.variables).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    defined: false,
                },
            ]);
            expect(result.properties).to.be.empty;
        });

        it("should not return a defined function as a variable", () => {
            const expression = " function render() {}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 function render() {}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.be.empty;
        });

        it("should not return a function's parameters as variables", () => {
            const expression = " function render(arg) {}";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 function render(arg) {}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.be.empty;
        });

        it("should not return a function's block-scoped variables as variables", () => {
            const expression = " function render(arg) { const v = 1; }";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 function render(arg) {}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).variables;

            expect(result).to.be.empty;
        });

        it("should not return properties set on a function's parameters as variables", () => {
            const expression = " function render(arg) { arg.prop = 1; }";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 function render(arg) {}",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            ).properties;

            expect(result).to.be.empty;
        });

        it("should return a function's globally-scoped variable references as variables", () => {
            const expression = " const g = {}; function f() { g.foo = 1; }";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content:
                    "0123456789\n1 const g = {}; function f() { g.foo = 1; }",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                false,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.variables).to.eql([
                {
                    contents: "g",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 8, 1, 9),
                    ),
                    defined: true,
                },
                {
                    contents: "g",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 31, 1, 32),
                    ),
                    defined: false,
                },
            ]);
            expect(result.properties).to.eql([
                {
                    contents: "foo",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 33, 1, 36),
                    ),
                    prefix: "g",
                    defined: true,
                },
            ]);
        });
    });

    describe("Diagnostics", () => {
        it("should error on an unterminated string", () => {
            const expression = " let v = '1234";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = '1234",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("'1234");
            expect(result.error?.at).to.equal(21);
            expect(result.error?.message).to.equal(
                "Unterminated string constant",
            );
        });

        it("should error on an unterminated multi-linestring", () => {
            const expression = " let v = '1234\\\n56";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = '1234\\\n56",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("'1234\\\n56");
            expect(result.error?.at).to.equal(21);
            expect(result.error?.message).to.equal(
                "Unterminated string constant",
            );
        });

        it("should error on an unterminated template literal", () => {
            const expression = " let v = `1234";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = `1234",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("1234");
            expect(result.error?.at).to.equal(22);
            expect(result.error?.message).to.equal("Unterminated template");
        });

        it("should error on an unbalanced delimiter", () => {
            const expression = " let v = { id: 1,";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = { id: 1,",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("{");
            expect(result.error?.at).to.equal(21);
            expect(result.error?.message).to.equal(
                "Opening '{' is missing a matching '}'",
            );
        });

        it("should error on an incomplete property accessor", () => {
            const expression = " v. = 1;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 v. = 1;",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal(".");
            expect(result.error?.at).to.equal(14);
            expect(result.error?.message).to.equal(
                "Expected property or method name after '.'",
            );
        });

        it("should error on an incomplete optional chaining operator", () => {
            const expression = " let v = q?. ?? 0;";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = q?. ?? 0;",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("?.");
            expect(result.error?.at).to.equal(22);
            expect(result.error?.message).to.equal(
                "Expected property, method, or call after optional chaining operator",
            );
        });

        it("should error on an incomplete expression", () => {
            const expression = " (v + );";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 (v + );",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("+");
            expect(result.error?.at).to.equal(16);
            expect(result.error?.message).to.equal(
                "Unexpected token; expression appears incomplete after operator",
            );
        });

        it("should error on an incomplete property definition", () => {
            const expression = " let v = { id : }";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 let v = { id : }",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal(":");
            expect(result.error?.at).to.equal(26);
            expect(result.error?.message).to.equal("Expected value after ':'");
        });

        it("should error on an incomplete non-catch control statement", () => {
            const expression = " if foo";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 if foo",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("f");
            expect(result.error?.at).to.equal(16);
            expect(result.error?.message).to.equal(
                "Unexpected token; expected '('",
            );
        });

        it("should error on an incomplete catch statement", () => {
            const expression = " try {} catch";
            const offset = 12;
            const state = buildParsingState({
                uri: "fake-uri",
                content: "0123456789\n1 try {} catch",
                callbacks: new MockCallbacks(),
            });
            const storyState: StoryFormatParsingState = {
                passageTokens: {},
            };

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                offset,
                state.textDocument,
                storyState,
            );

            expect(result.error?.contents).to.equal("");
            expect(result.error?.at).to.equal(25);
            expect(result.error?.message).to.equal(
                "Unexpected token; expected '{'",
            );
        });
    });
});
