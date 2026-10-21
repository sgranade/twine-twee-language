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

    describe("Returned Variables and Properties", () => {
        /**
         * One variable-extraction test case.
         */
        interface TestCase {
            description: string; // What the test is
            input: string; // Input to `tokenizeJavaScript()`
            isProgram: boolean; // Whether the input is a full program (instead of a snippet)
            assignmentIsDefinition?: boolean; // Whether to treat assignment as a definition
            variables: string[]; // Expected variables
            properties: string[]; // Expected property
            error?: string; // Expected error message, if any
        }

        /**
         * Turn tokenized JS into compact lists of strings.
         *
         * Variables are returned as `varname`, or `varname=` if it's being
         * assigned to.
         *
         * Properties are returned as `varname."p.q"`, or `varname."p.q"=` if it's
         * being assigned to.
         */
        function tokensToCompactStrings(result: uut.TokenizedJS) {
            const name = (s: string) =>
                /[.=]/.test(s) ? JSON.stringify(s) : s;
            return {
                variables: result.variables.map(
                    (v) => v.contents + (v.defined ? "=" : ""),
                ),
                properties: result.properties.map(
                    (p) =>
                        (p.prefix !== undefined ? p.prefix + "." : "") +
                        name(p.contents) +
                        (p.defined ? "=" : ""),
                ),
                error: result.error?.message,
            };
        }

        const testCases: TestCase[] = [
            // --- Chains ---
            {
                description: "a.b = 1",
                input: "a.b = 1",
                isProgram: true,
                variables: ["a"],
                properties: ["a.b="],
            },
            {
                description: "obj.a.b.c = 1",
                input: "obj.a.b.c = 1",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a=", "obj.a.b=", "obj.a.b.c="],
            },
            {
                description: "obj?.a?.b",
                input: "obj?.a?.b",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.a", "obj.a.b"],
            },
            {
                description: "obj['k']",
                input: "obj['k']",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.k"],
            },
            {
                description: "obj[1]",
                input: "obj[1]",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj['a b']",
                input: "obj['a b']",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.a b"],
            },
            {
                description: "obj['a.b'] // key w/a dot is quoted",
                input: "obj['a.b']",
                isProgram: false,
                variables: ["obj"],
                properties: ['obj."a.b"'],
            },
            {
                description: "obj['k='] // key w/an equals sign is quoted",
                input: "obj['k=']",
                isProgram: false,
                variables: ["obj"],
                properties: ['obj."k="'],
            },
            {
                description: "obj[i].name",
                input: "obj[i].name",
                isProgram: false,
                variables: ["obj", "i"],
                properties: [],
            },
            {
                description: "obj.items[0].name",
                input: "obj.items[0].name",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.items"],
            },
            {
                description: "obj().a",
                input: "obj().a",
                isProgram: false,
                variables: [],
                properties: [],
            },
            {
                description: "obj.a.b().c",
                input: "obj.a.b().c",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.a"],
            },

            // --- Object literals ---
            {
                description: "obj = {a: {b: 1}}",
                input: "obj = {a: {b: 1}}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a=", "obj.a.b="],
            },
            {
                description: "obj.x = {a: 1}",
                input: "obj.x = {a: 1}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.x=", "obj.x.a="],
            },
            {
                description: "var obj = {a: 1}",
                input: "var obj = {a: 1}",
                isProgram: true,
                variables: ["obj="],
                properties: ["obj.a="],
            },
            {
                description: "obj = {a} // defect 10: missing read of `a`",
                input: "obj = {a}",
                isProgram: true,
                variables: ["obj"], // defect 10
                properties: ["obj.a="],
            },
            {
                description: "obj = {a: b}",
                input: "obj = {a: b}",
                isProgram: true,
                variables: ["obj", "b"],
                properties: ["obj.a="],
            },
            {
                description: "obj = {'k': 1} // defect 6: string key dropped",
                input: "obj = {'k': 1}",
                isProgram: true,
                variables: ["obj"],
                properties: [], // defect 6
            },
            {
                description: "obj = {1: 'x'} // defect 6: numeric key dropped",
                input: "obj = {1: 'x'}",
                isProgram: true,
                variables: ["obj"],
                properties: [], // defect 6
            },
            {
                description: "x = {[k]: 1}",
                input: "x = {[k]: 1}",
                isProgram: true,
                variables: ["x", "k"],
                properties: [],
            },
            {
                description: "obj = {get a(){return 1}}",
                input: "obj = {get a(){return 1}}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a="],
            },

            // --- Binding forms ---
            {
                description: "let {a, b} = obj",
                input: "let {a, b} = obj",
                isProgram: true,
                variables: ["a=", "b=", "obj"],
                properties: [],
            },
            {
                description: "const {a, b} = obj",
                input: "const {a, b} = obj",
                isProgram: true,
                variables: ["a=", "b=", "obj"],
                properties: [],
            },
            {
                description: "var {a, b} = obj",
                input: "var {a, b} = obj",
                isProgram: true,
                variables: ["a=", "b=", "obj"],
                properties: [],
            },
            {
                description: "function f(){ var o = {a:1} }",
                input: "function f(){ var o = {a:1} }",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "for (let i=0;i<n;i++){i} // defect 2: loop head leaks `i` into globals",
                input: "for (let i=0;i<n;i++){i}",
                isProgram: true,
                variables: ["i=", "i", "n", "i", "i"], // defect 2
                properties: [],
            },
            {
                description:
                    "for (var j in obj){j} // defect 2: loop head leaks `j` into globals",
                input: "for (var j in obj){j}",
                isProgram: true,
                variables: ["j=", "obj", "j"], // defect 2
                properties: [],
            },
            {
                description: "for (a of b){}",
                input: "for (a of b){}",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description: "while(a){let b=1;b}",
                input: "while(a){let b=1;b}",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description:
                    "try{a()}catch(e){e.message} // defect 3: catch param leaks `e` into globals",
                input: "try{a()}catch(e){e.message}",
                isProgram: true,
                variables: ["e", "e"], // defect 3
                properties: ["e.message"], // defect 3
            },
            {
                description: "class A {} // defect 4: class name unbound",
                input: "class A {}",
                isProgram: true,
                variables: ["A"], // defect 4
                properties: [],
            },
            {
                description: "a = () => { b = 1 }",
                input: "a = () => { b = 1 }",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description: "foo = function(){ inner = 1 }",
                input: "foo = function(){ inner = 1 }",
                isProgram: true,
                variables: ["foo", "inner"],
                properties: [],
            },

            // --- Writes, w/ & w/o assignmentIsDefinition ---
            {
                description: "a = b = 1",
                input: "a = b = 1",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description: "a = b = 1, assignmentIsDefinition",
                input: "a = b = 1",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a=", "b="],
                properties: [],
            },
            {
                description: "a += 1",
                input: "a += 1",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "a += 1, assignmentIsDefinition",
                input: "a += 1",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a="],
                properties: [],
            },
            {
                description: "a++",
                input: "a++",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description:
                    "a++, assignmentIsDefinition // defect 9: ++ never counts as a write",
                input: "a++",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a"], // defect 9
                properties: [],
            },
            {
                description: "[a,b] = c",
                input: "[a,b] = c",
                isProgram: true,
                variables: ["a", "b", "c"],
                properties: [],
            },
            {
                description:
                    "[a,b] = c, assignmentIsDefinition // defect 9: destructuring never counts as a write",
                input: "[a,b] = c",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a", "b", "c"], // defect 9
                properties: [],
            },
            {
                description: "({a} = c)",
                input: "({a} = c)",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description:
                    "({a} = c), assignmentIsDefinition // defect 9: destructuring never counts as a write",
                input: "({a} = c)",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a", "c"], // defect 9
                properties: [],
            },
            {
                description: "a.b += 1",
                input: "a.b += 1",
                isProgram: true,
                variables: ["a"],
                properties: ["a.b="],
            },
            {
                description: "a.b += 1, assignmentIsDefinition",
                input: "a.b += 1",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a"],
                properties: ["a.b="],
            },
            {
                description: "var a; a = 1",
                input: "var a; a = 1",
                isProgram: true,
                variables: ["a=", "a"],
                properties: [],
            },
            {
                description: "var a; a = 1, assignmentIsDefinition",
                input: "var a; a = 1",
                isProgram: true,
                assignmentIsDefinition: true,
                variables: ["a=", "a="],
                properties: [],
            },

            // --- Calls ---
            {
                description: "foo(bar) // defect 1: argument lost entirely",
                input: "foo(bar)",
                isProgram: true,
                variables: [], // defect 1
                properties: [],
            },
            {
                description:
                    "foo(bar.baz) // inconsistent with foo(bar): the member-expression path still yields `bar`",
                input: "foo(bar.baz)",
                isProgram: true,
                variables: ["bar"],
                properties: ["bar.baz"],
            },
            {
                description: "a = foo(b) // defect 1: argument lost entirely",
                input: "a = foo(b)",
                isProgram: true,
                variables: ["a"], // defect 1
                properties: [],
            },
            {
                description: "new Foo(bar)",
                input: "new Foo(bar)",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "obj.method(x)",
                input: "obj.method(x)",
                isProgram: true,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj.a.method(x)",
                input: "obj.a.method(x)",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a"],
            },
            {
                description: "setTimeout(fn, 1)",
                input: "setTimeout(fn, 1)",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "parseInt(a)",
                input: "parseInt(a)",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "$('#x').hide()",
                input: "$('#x').hide()",
                isProgram: true,
                variables: [],
                properties: [],
            },

            // --- Built-ins ---
            {
                description: "Math.max(a,b)",
                input: "Math.max(a,b)",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "console.log(a)",
                input: "console.log(a)",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "window.foo = 1",
                input: "window.foo = 1",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "RegExp.test(a) // defect 8: RegExp missing from builtInObjects",
                input: "RegExp.test(a)",
                isProgram: true,
                variables: ["RegExp"], // defect 8
                properties: [],
            },
            {
                description:
                    "globalThis.z = 1 // defect 8: globalThis missing from builtInObjects",
                input: "globalThis.z = 1",
                isProgram: true,
                variables: ["globalThis"], // defect 8
                properties: ["globalThis.z="], // defect 8
            },
            {
                description: "this.foo = 1",
                input: "this.foo = 1",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "arr.length",
                input: "arr.length",
                isProgram: false,
                variables: ["arr"],
                properties: ["arr.length"],
            },
            {
                description: "State.variables.foo = 1",
                input: "State.variables.foo = 1",
                isProgram: true,
                variables: ["State"],
                properties: ["State.variables=", "State.variables.foo="],
            },
            {
                description: "setup.x = 1",
                input: "setup.x = 1",
                isProgram: true,
                variables: ["setup"],
                properties: ["setup.x="],
            },

            // --- Broken input (loose parse) ---
            {
                description: "a = ",
                input: "a = ",
                isProgram: true,
                variables: ["a"],
                properties: [],
                error: "Incomplete expression after the operator '='",
            },
            {
                description:
                    "obj. // defect 5: the loose-parse placeholder property reaches the index",
                input: "obj.",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.✖"], // defect 5
                error: "Missing property or method name after '.'",
            },
            {
                description:
                    "a.b. // defect 5: the loose-parse placeholder property reaches the index",
                input: "a.b.",
                isProgram: false,
                variables: ["a"],
                properties: ["a.b", "a.b.✖"], // defect 5
                error: "Missing property or method name after '.'",
            },
            {
                description:
                    "a ||= 1 // defect 7: ES2021 syntax fails under EcmaVersion 2020",
                input: "a ||= 1",
                isProgram: true,
                variables: [], // defect 7
                properties: [],
                error: "Incomplete expression after the operator '||'", // defect 7
            },
            {
                description:
                    "n = 1_000 // defect 7: ES2021 numeric separator fails under EcmaVersion 2020",
                input: "n = 1_000",
                isProgram: true,
                variables: ["n"],
                properties: [],
                error: "Missing space between a number and the following identifier", // defect 7
            },
            {
                description:
                    "class A { foo = 1 } // defect 7: ES2022 class field fails under EcmaVersion 2020",
                input: "class A { foo = 1 }",
                isProgram: true,
                variables: ["A"],
                properties: [],
                error: "Opening '{' is missing a matching '}'", // defect 7
            },
            {
                description: "export const a = 1",
                input: "export const a = 1",
                isProgram: true,
                variables: ["a="],
                properties: [],
                error: "'import' and 'export' may appear only with 'sourceType: module'",
            },
        ];

        for (const {
            description,
            input,
            isProgram,
            assignmentIsDefinition,
            variables,
            properties,
            error,
        } of testCases) {
            it(`should tokenize: ${description}`, () => {
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: input,
                    callbacks: new MockCallbacks(),
                });
                const storyState: StoryFormatParsingState = {
                    passageTokens: {},
                };

                const result = uut.tokenizeJavaScript(
                    isProgram,
                    input,
                    0,
                    state.textDocument,
                    storyState,
                    assignmentIsDefinition,
                );

                expect(tokensToCompactStrings(result)).to.eql({
                    variables,
                    properties,
                    error,
                });
            });
        }
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

            expect(result.error?.start).to.equal(21);
            expect(result.error?.end).to.equal(26);
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

            expect(result.error?.start).to.equal(21);
            expect(result.error?.end).to.equal(30);
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

            expect(result.error?.start).to.equal(22);
            expect(result.error?.end).to.equal(26);
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

            expect(result.error?.start).to.equal(21);
            expect(result.error?.end).to.equal(22);
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

            expect(result.error?.start).to.equal(14);
            expect(result.error?.end).to.equal(15);
            expect(result.error?.message).to.equal(
                "Missing property or method name after '.'",
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

            expect(result.error?.start).to.equal(22);
            expect(result.error?.end).to.equal(24);
            expect(result.error?.message).to.equal(
                "Missing property, method, or call after '?.'",
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

            expect(result.error?.start).to.equal(16);
            expect(result.error?.end).to.equal(17);
            expect(result.error?.message).to.equal(
                "Incomplete expression after the operator '+'",
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

            expect(result.error?.start).to.equal(26);
            expect(result.error?.end).to.equal(27);
            expect(result.error?.message).to.equal("Missing value after ':'");
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

            expect(result.error?.start).to.equal(13);
            expect(result.error?.end).to.equal(15);
            expect(result.error?.message).to.equal("Missing '(' after 'if'");
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

            expect(result.error?.start).to.equal(20);
            expect(result.error?.end).to.equal(25);
            expect(result.error?.message).to.equal("Missing '{' after 'catch'");
        });
    });
});
