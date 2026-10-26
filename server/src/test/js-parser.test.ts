import { expect } from "chai";
import "mocha";
import { Location, Range } from "vscode-languageserver";

import { buildParsingState, MockCallbacks } from "./builders";
import { ETokenType } from "../semantic-tokens";
import { StoryFormatParsingState } from "../passage-text-parsers";
import { browserGlobals } from "../passage-text-parsers/host-globals";
import { sugarCubeExcludedGlobals } from "../passage-text-parsers/sugarcube/sc2/sc2-twinescript";
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

        describe("Identifier Edge Cases", () => {
            /**
             * Tokenize `input` at offset 0 and return the semantic tokens as
             * `text@at:type` strings, in position order.
             */
            function tokensFor(input: string, isProgram = true): string[] {
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: input,
                    callbacks: new MockCallbacks(),
                });
                const storyState: StoryFormatParsingState = {
                    passageTokens: {},
                };

                uut.tokenizeJavaScript(
                    isProgram,
                    input,
                    0,
                    state.textDocument,
                    storyState,
                );

                const typeNames = Object.fromEntries(
                    Object.entries(ETokenType).map(([k, v]) => [v, k]),
                );
                return Object.values(storyState.passageTokens).map(
                    (t) => `${t.text}@${t.at}:${typeNames[t.type]}`,
                );
            }

            it("should set a variable token for an arrow function's parameter", () => {
                const result = tokensFor("(a) => a", false);

                expect(result).to.eql(["a@1:variable", "a@7:variable"]);
            });

            it("should not set a variable token for a function expression's parameter", () => {
                const result = tokensFor("f = function(a){ a }");

                expect(result).to.eql([
                    "f@0:variable",
                    "=@2:operator",
                    "a@17:variable",
                ]);
            });

            it("should set a property token on a member of a function-local variable", () => {
                const result = tokensFor("function f(o){ o.x }");

                expect(result).to.eql([
                    "f@9:variable",
                    "o@15:variable",
                    "x@17:property",
                ]);
            });

            it("should set a function token for a constructor's callee and a variable token for its argument", () => {
                const result = tokensFor("new Foo(bar)");

                expect(result).to.eql(["Foo@4:function", "bar@8:variable"]);
            });

            it("should set a function token for a member-expression constructor's callee", () => {
                const result = tokensFor("new obj.Foo(bar)");

                expect(result).to.eql([
                    "obj@4:variable",
                    "Foo@8:function",
                    "bar@12:variable",
                ]);
            });

            it("should not set a function token for a computed, non-static callee", () => {
                const result = tokensFor("obj[x](y)");

                expect(result).to.eql([
                    "obj@0:variable",
                    "x@4:variable",
                    "y@7:variable",
                ]);
            });

            it("should set a function token for a computed string-literal callee", () => {
                const result = tokensFor('obj["m"](x)');

                expect(result).to.eql([
                    "obj@0:variable",
                    '"m"@4:string',
                    "m@5:function",
                    "x@9:variable",
                ]);
            });

            it("should not set tokens for labels", () => {
                const result = tokensFor("l: while(a){ continue l }");

                expect(result).to.eql(["a@9:variable"]);
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
                    assigned: false,
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
                { isAssignmentContext: true }, // Force assignment to be definition
            );

            expect(result.variables).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 2, 1, 6),
                    ),
                    assigned: true,
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
                    assigned: false,
                },
                {
                    contents: "val1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 21),
                    ),
                    assigned: false,
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
                    assigned: false,
                },
                {
                    contents: "val1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 25, 1, 29),
                    ),
                    assigned: false,
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
                    assigned: false,
                },
                {
                    contents: "var2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 11),
                    ),
                    assigned: false,
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
                { isAssignmentContext: true },
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 7, 1, 16),
                    ),
                    prefix: "var1",
                    assigned: false,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 26),
                    ),
                    prefix: "var1.rootprop1",
                    assigned: true,
                },
                {
                    contents: "prop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 30, 1, 35),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    assigned: true,
                },
                {
                    contents: "prop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 43, 1, 48),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    assigned: true,
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
                { isAssignmentContext: true },
            ).properties;

            expect(result).to.eql([
                {
                    contents: "rootprop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 8, 1, 17),
                    ),
                    prefix: "var1",
                    assigned: false,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 20, 1, 29),
                    ),
                    prefix: "var1.rootprop1",
                    assigned: true,
                },
                {
                    contents: "prop1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 33, 1, 38),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    assigned: true,
                },
                {
                    contents: "prop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 46, 1, 51),
                    ),
                    prefix: "var1.rootprop1.rootprop2",
                    assigned: true,
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
                    assigned: false,
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
                    assigned: false,
                },
                {
                    contents: "rootprop2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 17, 1, 26),
                    ),
                    prefix: "var1.rootprop1",
                    assigned: false,
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
                    assigned: false,
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
                    assigned: false,
                },
            ]);
        });

        it("should return a called function as a variable", () => {
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
                    assigned: false,
                },
                {
                    contents: "funcme",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 9, 1, 15),
                    ),
                    assigned: false,
                },
            ]);
        });

        it("should return a member function called on a variables as a property", () => {
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
                    assigned: false,
                },
                {
                    contents: "var2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 9, 1, 13),
                    ),
                    assigned: false,
                },
            ]);
            expect(result.properties).to.eql([
                {
                    contents: "funcme",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 14, 1, 20),
                    ),
                    prefix: "var2",
                    assigned: false,
                    isCallee: true,
                },
            ]);
        });

        it("should locate a quoted object-literal key at its names", () => {
            const expression = "obj = {'k': 1, 22: 2}";
            const state = buildParsingState({
                uri: "fake-uri",
                content: expression,
                callbacks: new MockCallbacks(),
            });

            const result = uut.tokenizeJavaScript(
                true,
                expression,
                0,
                state.textDocument,
                { passageTokens: {} },
            );

            expect(
                result.properties.map((p) => [
                    p.contents,
                    p.location.range.start.character,
                    p.location.range.end.character,
                ]),
            ).to.eql([["k", 8, 9]]);
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
                    assigned: false,
                },
            ]);
            expect(result.properties).to.be.empty;
        });

        it("should not return a declared function as a variable", () => {
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
                { isAssignmentContext: true },
            );

            expect(result.variables).to.eql([
                {
                    contents: "g",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 8, 1, 9),
                    ),
                    assigned: true,
                },
                {
                    contents: "f",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 25, 1, 26),
                    ),
                    assigned: true,
                },
                {
                    contents: "g",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 31, 1, 32),
                    ),
                    assigned: false,
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
                    assigned: true,
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
            isAssignmentContext?: boolean; // Whether we're in an assignment context
            hostGlobals?: ReadonlySet<string>; // Host globals (browser; libraries) that a story format would set
            variables: string[]; // Expected variables
            properties: string[]; // Expected property
            error?: string; // Expected error message, if any
            ignoreError?: boolean; // A test case that's only checking the symbols and doesn't care about the error
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
                    (v) => v.contents + (v.assigned ? "=" : ""),
                ),
                properties: result.properties.map(
                    (p) =>
                        (p.prefix !== undefined ? p.prefix + "." : "") +
                        name(p.contents) +
                        (p.assigned ? "=" : "") +
                        (p.isCallee ? "()" : ""),
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
                properties: ["a.b"],
            },
            {
                description: "a.b = 1, isAssignmentContext",
                input: "a.b = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a"],
                properties: ["a.b="],
            },
            {
                description: "obj.a.b.c = 1",
                input: "obj.a.b.c = 1",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a", "obj.a.b", "obj.a.b.c"],
            },
            {
                description: "obj.a.b.c = 1, isAssignmentContext",
                input: "obj.a.b.c = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["obj"],
                properties: ["obj.a", "obj.a.b", "obj.a.b.c="],
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
                input: "obj['a b'] // a key that isn't an identifier is dynamic",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj['a.b'] // dotted key would collide w/obj.a.b",
                input: "obj['a.b']",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj['a.b'].c // nothing after a dynamic key",
                input: "obj['a.b'].c",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj['k=']",
                input: "obj['k=']",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj['1']",
                input: "obj['1']",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description:
                    "obj['\\u0061'] // an escaped key doesn't match its source text",
                input: "obj['\\u0061']",
                isProgram: false,
                variables: ["obj"],
                properties: [],
            },
            {
                description:
                    "obj['class'] // reserved words are valid property names",
                input: "obj['class']",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.class"],
            },
            {
                description: "obj['café']",
                input: "obj['café']",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.café"],
            },
            {
                description: "obj['$a_1']",
                input: "obj['$a_1']",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.$a_1"],
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
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj.a.b().c",
                input: "obj.a.b().c",
                isProgram: false,
                variables: ["obj"],
                properties: ["obj.a", "obj.a.b()"],
            },

            // --- Object literals ---
            {
                description: "obj = {a: {b: 1}}",
                input: "obj = {a: {b: 1}}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.a", "obj.a.b"],
            },
            {
                description: "obj = {a: {b: 1}}, isAssignmentContext",
                input: "obj = {a: {b: 1}}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["obj="],
                properties: ["obj.a=", "obj.a.b="],
            },
            {
                description: "obj.x = {a: 1}",
                input: "obj.x = {a: 1}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.x", "obj.x.a"],
            },
            {
                description: "obj.x = {a: 1}, isAssignmentContext",
                input: "obj.x = {a: 1}",
                isProgram: true,
                isAssignmentContext: true,
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
                description:
                    "obj = {a} // shorthand's both the property and a read",
                input: "obj = {a}",
                isProgram: true,
                variables: ["obj", "a"],
                properties: ["obj.a"],
            },
            {
                description: "obj = {a}, isAssignmentContext",
                input: "obj = {a}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["obj=", "a"],
                properties: ["obj.a="],
            },
            {
                description: "obj = {a: b}",
                input: "obj = {a: b}",
                isProgram: true,
                variables: ["obj", "b"],
                properties: ["obj.a"],
            },
            {
                description: "obj = {a: b}, isAssignmentContext",
                input: "obj = {a: b}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["obj=", "b"],
                properties: ["obj.a="],
            },
            {
                description: "obj = {'k': 1}",
                input: "obj = {'k': 1}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.k"],
            },
            {
                description: "obj = {1: 'x'} // numeric keys aren't indexed",
                input: "obj = {1: 'x'}",
                isProgram: true,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj = {0x10: 1, 1.0: 2}",
                input: "obj = {0x10: 1, 1.0: 2}",
                isProgram: true,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj = {'1': 1, 'a.b': 2, 'my key': 3}",
                input: "obj = {'1': 1, 'a.b': 2, 'my key': 3}",
                isProgram: true,
                variables: ["obj"],
                properties: [],
            },
            {
                description: "obj = {'café': 1}",
                input: "obj = {'café': 1}",
                isProgram: true,
                variables: ["obj"],
                properties: ["obj.café"],
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
                properties: ["obj.a"],
            },
            {
                description: "obj = {get a(){return 1}}, isAssignmentContext",
                input: "obj = {get a(){return 1}}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["obj="],
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
                variables: ["f="],
                properties: [],
            },
            {
                description: "for (let i=0;i<n;i++){i}",
                input: "for (let i=0;i<n;i++){i}",
                isProgram: true,
                variables: ["n"],
                properties: [],
            },
            {
                description: "for (var j in obj){j}",
                input: "for (var j in obj){j}",
                isProgram: true,
                variables: ["j=", "obj", "j"],
                properties: [],
            },
            {
                description: "for (const x of xs){x}",
                input: "for (const x of xs){x}",
                isProgram: true,
                variables: ["xs"],
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
                description: "try{a()}catch(e){e.message}",
                input: "try{a()}catch(e){e.message}",
                isProgram: true,
                variables: ["a"], // a's a callee read
                properties: [],
            },
            {
                description: "try{a()}catch({message}){message}",
                input: "try{a()}catch({message}){message}",
                isProgram: true,
                variables: ["a"], // a's a callee read
                properties: [],
            },
            {
                description:
                    "try{}catch({a = b}){a} // a catch param's default value is still a read",
                input: "try{}catch({a = b}){a}",
                isProgram: true,
                variables: ["b"],
                properties: [],
            },
            {
                description:
                    "try{}catch({[k]: v}){v} // a catch param's computed key is still a read",
                input: "try{}catch({[k]: v}){v}",
                isProgram: true,
                variables: ["k"],
                properties: [],
            },
            {
                description:
                    "try{}catch([a, b = a]){} // a catch param's default sees earlier params",
                input: "try{}catch([a, b = a]){}",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "class A {} // class names, as a global declaration, counts as a definition",
                input: "class A {}",
                isProgram: true,
                variables: ["A="],
                properties: [],
            },
            {
                description: "class A { foo(){} [bar](){} }",
                input: "class A { foo(){} [bar](){} }",
                isProgram: true,
                variables: ["A=", "bar"],
                properties: [],
            },
            {
                description: "const B = class Named { foo(){ return Named } }",
                input: "const B = class Named { foo(){ return Named } }",
                isProgram: true,
                variables: ["B="],
                properties: [],
            },
            {
                description:
                    "(function(){ on('x', handler); function handler(){} })() // a hoisted function declaration, so an earlier reference binds to it",
                input: "(function(){ on('x', handler); function handler(){} })()",
                isProgram: true,
                variables: ["on"],
                properties: [],
            },
            {
                description:
                    "(function(){ init(); function init(){} })() // a hoisted function called before its declaration, which binds",
                input: "(function(){ init(); function init(){} })()",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "(function(){ const cb = () => count; let count = 0; })() // a closure over a later `let` binds to it",
                input: "(function(){ const cb = () => count; let count = 0; })()",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "function f(){ if (x) { function g(){} } return g } // a function declared in a block binds only in that block (no sloppy-mode Annex B hoisting)",
                input: "function f(){ if (x) { function g(){} } return g }",
                isProgram: true,
                variables: ["f=", "x", "g"],
                properties: [],
            },
            {
                description:
                    "function f(){ return arguments } // `arguments` is bound implicitly in a function",
                input: "function f(){ return arguments }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "function f(){ return () => arguments } // an arrow sees its enclosing function's `arguments`",
                input: "function f(){ return () => arguments }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "arguments // a top level `arguments` is unbound and so is a story variable",
                input: "arguments",
                isProgram: true,
                variables: ["arguments"],
                properties: [],
            },
            {
                description:
                    "class A { static { let z = 1; var w = 2; z; w } } // a static block is its own function-like scope; neither `let` nor `var` leaks",
                input: "class A { static { let z = 1; var w = 2; z; w } }",
                isProgram: true,
                variables: ["A="],
                properties: [],
            },
            {
                description:
                    "switch (k) { case 1: let y = 2; y } // `switch` cases share one block scope",
                input: "switch (k) { case 1: let y = 2; y }",
                isProgram: true,
                variables: ["k"],
                properties: [],
            },
            {
                description:
                    "const f = function named(){ let x = named; } // a named function expression's name binds inside it",
                input: "const f = function named(){ let x = named; }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "const f = function named(named){ return named } // a param shadows a named function expression's name",
                input: "const f = function named(named){ return named }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "with (obj) { y } // `y` might be `obj.y`; there's no way to know, so it stays a story variable",
                input: "with (obj) { y }",
                isProgram: true,
                variables: ["obj", "y"],
                properties: [],
            },
            {
                description:
                    "function f(a = b){ var b } // params don't see body `var`s",
                input: "function f(a = b){ var b }",
                isProgram: true,
                variables: ["f=", "b"],
                properties: [],
            },
            {
                description:
                    "x; let x = 1 //  hoisting doesn't change the top level, where every name is global",
                input: "x; let x = 1",
                isProgram: true,
                variables: ["x", "x="],
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

            // --- Writes, w/ & w/o isAssignmentContext ---
            {
                description: "a = b = 1",
                input: "a = b = 1",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description: "a = b = 1, isAssignmentContext",
                input: "a = b = 1",
                isProgram: true,
                isAssignmentContext: true,
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
                description: "a += 1, isAssignmentContext",
                input: "a += 1",
                isProgram: true,
                isAssignmentContext: true,
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
                description: "a++, isAssignmentContext",
                input: "a++",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a="],
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
                    "[a,b] = c, isAssignmentContext // destructuring counts as a write",
                input: "[a,b] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "b=", "c"],
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
                    "({a} = c), isAssignmentContext // destructuring counts as a write",
                input: "({a} = c)",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "a.b += 1",
                input: "a.b += 1",
                isProgram: true,
                variables: ["a"],
                properties: ["a.b"],
            },
            {
                description: "a.b += 1, isAssignmentContext",
                input: "a.b += 1",
                isProgram: true,
                isAssignmentContext: true,
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
                description: "var a; a = 1, isAssignmentContext",
                input: "var a; a = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "a="],
                properties: [],
            },

            // --- Calls ---
            {
                description:
                    "$utils.greet() // a method-call property is a callee occurrence",
                input: "$utils.greet()",
                isProgram: true,
                variables: ["$utils"],
                properties: ["$utils.greet()"],
            },
            {
                description: "$utils.greet = function(){}, isAssignmentContext",
                input: "$utils.greet = function(){}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["$utils"],
                properties: ["$utils.greet="],
            },
            {
                description: "$arr.push(x) // a called method name is a callee",
                input: "$arr.push(x)",
                isProgram: true,
                variables: ["$arr", "x"],
                properties: ["$arr.push()"],
            },
            {
                description:
                    "$arr.push = f // a non-called method name isn't a callee",
                input: "$arr.push = f",
                isProgram: true,
                variables: ["$arr", "f"],
                properties: ["$arr.push"],
            },
            {
                description: "y = $arr.push",
                input: "y = $arr.push",
                isProgram: true,
                variables: ["y", "$arr"],
                properties: ["$arr.push"],
            },
            {
                description: "new $a.B(x)",
                input: "new $a.B(x)",
                isProgram: true,
                variables: ["$a", "x"],
                properties: ["$a.B()"],
            },
            {
                description:
                    "throw new TypeError('x') // built-in constructors aren't story variables",
                input: "throw new TypeError('x')",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description:
                    "requestAnimationFrame(tick) // host callees aren't story variables",
                input: "requestAnimationFrame(tick)",
                isProgram: true,
                hostGlobals: browserGlobals,
                variables: ["tick"],
                properties: [],
            },
            {
                description:
                    "alert(x) // Chapbook: alert is deliberately a story variable",
                input: "alert(x)",
                isProgram: true,
                hostGlobals: browserGlobals,
                variables: ["alert", "x"],
                properties: [],
            },
            {
                description:
                    "const {a} = o // destructuring shorthand isn't a property",
                input: "const {a} = o",
                isProgram: true,
                variables: ["a=", "o"],
                properties: [],
            },
            {
                description: "const {a} = o, isAssignmentContext",
                input: "const {a} = o",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "o"],
                properties: [],
            },
            {
                description:
                    "function f({a}){} // a parameter pattern's shorthand isn't a property",
                input: "function f({a}){}",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description: "function f({a}){}, isAssignmentContext",
                input: "function f({a}){}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "({a} = c) // pattern shorthand yields one variable and no property",
                input: "({a} = c)",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description:
                    "({a} = c), isAssignmentContext // pattern shorthand yields one variable and no property",
                input: "({a} = c)",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "foo(bar)",
                input: "foo(bar)",
                isProgram: true,
                variables: ["foo", "bar"],
                properties: [],
            },
            {
                description:
                    "foo(bar.baz) // inconsistent with foo(bar): the member-expression path still yields `bar`",
                input: "foo(bar.baz)",
                isProgram: true,
                variables: ["foo", "bar"],
                properties: ["bar.baz"],
            },
            {
                description: "a = foo(b)",
                input: "a = foo(b)",
                isProgram: true,
                variables: ["a", "foo", "b"],
                properties: [],
            },
            {
                description: "new Foo(bar)",
                input: "new Foo(bar)",
                isProgram: true,
                variables: ["Foo", "bar"],
                properties: [],
            },
            {
                description:
                    "new a.B(x) // a member-expression constructor's callee is a callee property like a.b(x)'s",
                input: "new a.B(x)",
                isProgram: true,
                variables: ["a", "x"],
                properties: ["a.B()"],
            },
            {
                description:
                    'obj["m"](x) // a string-literal callee is a callee property like obj.m(x)\'s',
                input: 'obj["m"](x)',
                isProgram: true,
                variables: ["obj", "x"],
                properties: ["obj.m()"],
            },
            {
                description: "obj[k](x)",
                input: "obj[k](x)",
                isProgram: true,
                variables: ["obj", "k", "x"],
                properties: [],
            },
            {
                description: "obj.method(x)",
                input: "obj.method(x)",
                isProgram: true,
                variables: ["obj", "x"],
                properties: ["obj.method()"],
            },
            {
                description: "obj.a.method(x)",
                input: "obj.a.method(x)",
                isProgram: true,
                variables: ["obj", "x"],
                properties: ["obj.a", "obj.a.method()"],
            },
            {
                description: "setTimeout(fn, 1)",
                input: "setTimeout(fn, 1)",
                isProgram: true,
                hostGlobals: browserGlobals,
                variables: ["fn"],
                properties: [],
            },
            {
                description: "parseInt(a)",
                input: "parseInt(a)",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description:
                    "$('#x').hide() // jQuery, which SugarCube's hostGlobals suppresses",
                input: "$('#x').hide()",
                isProgram: true,
                hostGlobals: sugarCubeExcludedGlobals,
                variables: [],
                properties: [],
            },

            // --- Built-ins ---
            {
                description: "Math.max(a,b)",
                input: "Math.max(a,b)",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description:
                    "console.log(a) // `console`, which browserGlobals suppresses",
                input: "console.log(a)",
                isProgram: true,
                hostGlobals: browserGlobals,
                variables: ["a"],
                properties: [],
            },
            {
                description: "window.foo = 1",
                input: "window.foo = 1",
                isProgram: true,
                hostGlobals: browserGlobals,
                variables: [],
                properties: [],
            },
            {
                description:
                    "window.foo = 1 // `window` is returned when there are no hostGlobals",
                input: "window.foo = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["window"],
                properties: ["window.foo="],
            },
            {
                description:
                    "location.x = history // allowed by our Chapbook parser",
                input: "location.x = history",
                isProgram: true,
                isAssignmentContext: true,
                hostGlobals: browserGlobals,
                variables: ["location", "history"],
                properties: ["location.x="],
            },
            {
                description:
                    "location.x = history // SugarCube: no bare name is a story variable",
                input: "location.x = history",
                isProgram: true,
                hostGlobals: sugarCubeExcludedGlobals,
                variables: [],
                properties: [],
            },
            {
                description:
                    "jQuery.fx.off = a // SugarCube: doesn't see jQuery",
                input: "jQuery.fx.off = a",
                isProgram: true,
                hostGlobals: sugarCubeExcludedGlobals,
                variables: ["a"],
                properties: [],
            },
            {
                description: "new TypeError(m)",
                input: "new TypeError(m)",
                isProgram: true,
                variables: ["m"],
                properties: [],
            },
            {
                description: "Uint8Array.from(a)",
                input: "Uint8Array.from(a)",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "[undefined, NaN, Infinity, x]",
                input: "[undefined, NaN, Infinity, x]",
                isProgram: false,
                variables: ["x"],
                properties: [],
            },
            {
                description: "RegExp.test(a)",
                input: "RegExp.test(a)",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "globalThis.z = 1",
                input: "globalThis.z = 1",
                isProgram: true,
                variables: [],
                properties: [],
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
                properties: ["State.variables", "State.variables.foo"],
            },
            {
                description: "State.variables.foo = 1, isAssignmentContext",
                input: "State.variables.foo = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["State"],
                properties: ["State.variables", "State.variables.foo="],
            },
            {
                description: "setup.x = 1",
                input: "setup.x = 1",
                isProgram: true,
                variables: ["setup"],
                properties: ["setup.x"],
            },
            {
                description: "setup.x = 1, isAssignmentContext",
                input: "setup.x = 1",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["setup"],
                properties: ["setup.x="],
            },

            // --- Member targets, with and without isAssignmentContext ---
            {
                description: "[o.x] = c",
                input: "[o.x] = c",
                isProgram: true,
                variables: ["o", "c"],
                properties: ["o.x"],
            },
            {
                description: "[o.x] = c, isAssignmentContext",
                input: "[o.x] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "c"],
                properties: ["o.x="],
            },
            {
                description: "({k: o.x} = c)",
                input: "({k: o.x} = c)",
                isProgram: true,
                variables: ["o", "c"],
                properties: ["o.x"],
            },
            {
                description: "({k: o.x} = c), isAssignmentContext",
                input: "({k: o.x} = c)",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "c"],
                properties: ["o.x="],
            },
            {
                description: "[o.x = 1] = c",
                input: "[o.x = 1] = c",
                isProgram: true,
                variables: ["o", "c"],
                properties: ["o.x"],
            },
            {
                description: "[o.x = 1] = c, isAssignmentContext",
                input: "[o.x = 1] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "c"],
                properties: ["o.x="],
            },
            {
                description: "[...o.x] = c",
                input: "[...o.x] = c",
                isProgram: true,
                variables: ["o", "c"],
                properties: ["o.x"],
            },
            {
                description: "[...o.x] = c, isAssignmentContext",
                input: "[...o.x] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "c"],
                properties: ["o.x="],
            },
            {
                description: "o.x++",
                input: "o.x++",
                isProgram: true,
                variables: ["o"],
                properties: ["o.x"],
            },
            {
                description: "o.x++, isAssignmentContext",
                input: "o.x++",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o"],
                properties: ["o.x="],
            },
            {
                description: "for (o.x of y) {}",
                input: "for (o.x of y) {}",
                isProgram: true,
                variables: ["o", "y"],
                properties: ["o.x"],
            },
            {
                description: "for (o.x of y) {}, isAssignmentContext",
                input: "for (o.x of y) {}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "y"],
                properties: ["o.x="],
            },
            {
                description: "for (o.x in y) {}",
                input: "for (o.x in y) {}",
                isProgram: true,
                variables: ["o", "y"],
                properties: ["o.x"],
            },
            {
                description: "for (o.x in y) {}, isAssignmentContext",
                input: "for (o.x in y) {}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "y"],
                properties: ["o.x="],
            },
            {
                description: "[o[i].x] = c",
                input: "[o[i].x] = c",
                isProgram: true,
                variables: ["o", "i", "c"],
                properties: [],
            },
            {
                description: "[o[i].x] = c, isAssignmentContext",
                input: "[o[i].x] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["o", "i", "c"],
                properties: [],
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
                description: "obj.",
                input: "obj.",
                isProgram: false,
                variables: ["obj"],
                properties: [],
                error: "Missing property or method name after '.'",
            },
            {
                description: "a.b.",
                input: "a.b.",
                isProgram: false,
                variables: ["a"],
                properties: ["a.b"],
                error: "Missing property or method name after '.'",
            },
            {
                description: "a ||= 1 // ES2021 or-equals syntax",
                input: "a ||= 1",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "n = 1_000 // ES2021 numeric separator",
                input: "n = 1_000",
                isProgram: true,
                variables: ["n"],
                properties: [],
            },
            {
                description: "class A { foo = 1 } // ES2022 class field",
                input: "class A { foo = 1 }",
                isProgram: true,
                variables: ["A="],
                properties: [],
            },
            {
                description: "export const a = 1",
                input: "export const a = 1",
                isProgram: true,
                variables: ["a="],
                properties: [],
                error: "'import' and 'export' may appear only with 'sourceType: module'",
            },
            // --- Default-value scoping ---
            {
                description: "function f(a = b){}",
                input: "function f(a = b){}",
                isProgram: true,
                variables: ["f=", "b"],
                properties: [],
            },
            {
                description: "const {a = b} = c",
                input: "const {a = b} = c",
                isProgram: true,
                variables: ["a=", "b", "c"],
                properties: [],
            },
            {
                description: "const [a = b] = c",
                input: "const [a = b] = c",
                isProgram: true,
                variables: ["a=", "b", "c"],
                properties: [],
            },
            {
                description: "f = (a = b) => a",
                input: "f = (a = b) => a",
                isProgram: true,
                variables: ["f", "b"],
                properties: [],
            },
            {
                description: "const {[k]: v} = o",
                input: "const {[k]: v} = o",
                isProgram: true,
                variables: ["k", "v=", "o"],
                properties: [],
            },
            {
                description: "function f(a, b = a){}",
                input: "function f(a, b = a){}",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "class A { static s = A } // the class's inner self-binding resolves to the outer name",
                input: "class A { static s = A }",
                isProgram: true,
                variables: ["A=", "A"],
                properties: [],
            },
            {
                description:
                    "function f(){ var v; eval('x'); return v } // a direct eval doesn't turn locals into story variables",
                input: "function f(){ var v; eval('x'); return v }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description: "import x from 'y'; x // module syntax is scoped",
                input: "import x from 'y'; x",
                isProgram: true,
                variables: ["x"],
                properties: [],
                error: "'import' and 'export' may appear only with 'sourceType: module'",
            },

            // --- Writes in an assignment context ---
            {
                description: "for (a of b) with isAssignmentContext",
                input: "for (a of b) {}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "b"],
                properties: [],
            },

            // --- Functions ---
            {
                description: "function f(){}",
                input: "function f(){}",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description: "function f(){} with isAssignmentContext",
                input: "function f(){}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["f="],
                properties: [],
            },
            {
                description: "function f(){ function g(){} }",
                input: "function f(){ function g(){} }",
                isProgram: true,
                variables: ["f="],
                properties: [],
            },
            {
                description:
                    "function f(){ function g(){} } with isAssignmentContext",
                input: "function f(){ function g(){} }",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["f="],
                properties: [],
            },
            {
                description: "[a = 1] = c",
                input: "[a = 1] = c",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description: "[a = 1] = c with isAssignmentContext",
                input: "[a = 1] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "[a = b] = c",
                input: "[a = b] = c",
                isProgram: true,
                variables: ["a", "b", "c"],
                properties: [],
            },
            {
                description: "[a = b] = c with isAssignmentContext",
                input: "[a = b] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "b", "c"],
                properties: [],
            },
            {
                description: "({a = 1} = c)",
                input: "({a = 1} = c)",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description: "({a = 1} = c) with isAssignmentContext",
                input: "({a = 1} = c)",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "[...a] = c",
                input: "[...a] = c",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description: "[...a] = c with isAssignmentContext",
                input: "[...a] = c",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "({...a} = c)",
                input: "({...a} = c)",
                isProgram: true,
                variables: ["a", "c"],
                properties: [],
            },
            {
                description: "({...a} = c) with isAssignmentContext",
                input: "({...a} = c)",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "c"],
                properties: [],
            },
            {
                description: "--a",
                input: "--a",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "--a with isAssignmentContext",
                input: "--a",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a="],
                properties: [],
            },
            {
                description: "a--",
                input: "a--",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
            {
                description: "a-- with isAssignmentContext",
                input: "a--",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a="],
                properties: [],
            },
            {
                description: "for (a in b) {}",
                input: "for (a in b) {}",
                isProgram: true,
                variables: ["a", "b"],
                properties: [],
            },
            {
                description: "for (a in b) {} with isAssignmentContext",
                input: "for (a in b) {}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "b"],
                properties: [],
            },
            {
                description: "for ([a, b] of c) {}",
                input: "for ([a, b] of c) {}",
                isProgram: true,
                variables: ["a", "b", "c"],
                properties: [],
            },
            {
                description: "for ([a, b] of c) {} with isAssignmentContext",
                input: "for ([a, b] of c) {}",
                isProgram: true,
                isAssignmentContext: true,
                variables: ["a=", "b=", "c"],
                properties: [],
            },

            // --- Half-typed input never throws ---
            ...(
                [
                    ["obj.", ["obj"], []],
                    ["foo(", ["foo"], []],
                    ["let = ", ["let"], []],
                    ["for (let i of", [], []],
                    ["class {", [], []],
                    ["$x.y.", ["$x"], ["$x.y"]],
                    ["{ a: }", [], []],
                    ["function (", [], []],
                    ["obj?.", ["obj"], []],
                    ["`${a ", ["a"], []],
                    ["new ", [], []],
                    ["if (", [], []],
                    ["x = {a:", ["x"], ["x.a"]],
                    ["try{}catch(", [], []],
                    ["import x from", [], []],
                ] as [string, string[], string[]][]
            ).map(([input, variables, properties]): TestCase => ({
                description: `half-typed ${JSON.stringify(input)} doesn't throw`,
                input,
                isProgram: false,
                variables,
                properties,
                ignoreError: true,
            })),

            // --- Labels ---
            {
                description: "l: for(;;){ break l }",
                input: "l: for(;;){ break l }",
                isProgram: true,
                variables: [],
                properties: [],
            },
            {
                description: "l: while(a){ continue l }",
                input: "l: while(a){ continue l }",
                isProgram: true,
                variables: ["a"],
                properties: [],
            },
        ];

        for (const {
            description,
            input,
            isProgram,
            isAssignmentContext,
            hostGlobals,
            variables,
            properties,
            error,
            ignoreError,
        } of testCases) {
            it(`should tokenize: ${description}`, () => {
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: input,
                    callbacks: new MockCallbacks(),
                });
                const storyState: StoryFormatParsingState = {
                    passageTokens: {},
                    hostGlobals: hostGlobals,
                };

                const result = uut.tokenizeJavaScript(
                    isProgram,
                    input,
                    0,
                    state.textDocument,
                    storyState,
                    { isAssignmentContext },
                );

                const actual = tokensToCompactStrings(result);
                if (ignoreError) actual.error = undefined;
                expect(actual).to.eql({ variables, properties, error });
            });
        }
    });

    describe("Write parity between identifiers and members", () => {
        // Identifiers are classified by eslint-scope and members by our own
        // check (`isWriteTarget`), so they must agree on every position.
        const templates = [
            "X = c",
            "X += c",
            "X++",
            "--X",
            "[X] = c",
            "[[X]] = c",
            "({k: X} = c)",
            "[X = 1] = c",
            "({k: X = 1} = c)",
            "[...X] = c",
            "({...X} = c)",
            "for (X of y) {}",
            "for (X in y) {}",
            "for ([X] of y) {}",
        ];

        function isWritten(input: string, flag: boolean, member: boolean) {
            const state = buildParsingState({
                uri: "fake-uri",
                content: input,
                callbacks: new MockCallbacks(),
            });
            const result = uut.tokenizeJavaScript(
                true,
                input,
                0,
                state.textDocument,
                { passageTokens: {} },
                { isAssignmentContext: flag },
            );
            return member
                ? result.properties.find((p) => p.contents === "x")?.assigned
                : result.variables.find((v) => v.contents === "t")?.assigned;
        }

        for (const template of templates) {
            for (const flag of [false, true]) {
                it(`should treat ${template} the same for an identifier and a member${flag ? ", isAssignmentContext" : ""}`, () => {
                    const identifier = isWritten(
                        template.replace("X", "t"),
                        flag,
                        false,
                    );
                    const member = isWritten(
                        template.replace("X", "o.x"),
                        flag,
                        true,
                    );

                    expect(identifier).to.equal(flag);
                    expect(member).to.equal(flag);
                });
            }
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
