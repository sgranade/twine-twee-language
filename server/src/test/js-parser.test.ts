import { expect } from "chai";
import "mocha";
import { Location, Range } from "vscode-languageserver";

import { buildParsingState, MockCallbacks } from "./builders";
import { ETokenType } from "../tokens";
import { StoryFormatParsingState } from "../passage-text-parsers";
import * as uut from "../js-parser";

describe("JS Parser", () => {
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );
        const result = storyState.passageTokens;

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
        const state = buildParsingState({
            uri: "fake-uri",
            content: "fake content",
            callbacks: new MockCallbacks(),
        });
        const storyState: StoryFormatParsingState = {
            passageTokens: {},
        };

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[0]).to.eql([
            {
                contents: "var1",
                location: Location.create("fake-uri", Range.create(1, 2, 1, 6)),
            },
        ]);
        expect(result[1]).to.be.empty;
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[0]).to.eql([
            {
                contents: "var1",
                location: Location.create("fake-uri", Range.create(1, 2, 1, 6)),
            },
            {
                contents: "val1",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 25, 1, 29)
                ),
            },
        ]);
        expect(result[1]).to.be.empty; // Because the properties can't be traced back to a root variable
    });

    it("should return apparent properties that trace back to a root variable", () => {
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[1]).to.eql([
            {
                contents: "rootprop1",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 7, 1, 16)
                ),
                scope: "var1",
            },
            {
                contents: "rootprop2",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 17, 1, 26)
                ),
                scope: "var1.rootprop1",
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[1]).to.eql([
            {
                contents: "rootprop1",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 7, 1, 16)
                ),
                scope: "var1",
            },
            {
                contents: "rootprop2",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 17, 1, 26)
                ),
                scope: "var1.rootprop1",
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[0]).to.eql([
            {
                contents: "var1",
                location: Location.create("fake-uri", Range.create(1, 2, 1, 6)),
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[0]).to.eql([
            {
                contents: "var1",
                location: Location.create("fake-uri", Range.create(1, 2, 1, 6)),
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

        const result = uut.tokenizeJSExpression(
            expression,
            offset,
            state.textDocument,
            storyState
        );

        expect(result[0]).to.eql([
            {
                contents: "var1",
                location: Location.create("fake-uri", Range.create(1, 2, 1, 6)),
            },
            {
                contents: "var2",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 9, 1, 13)
                ),
            },
        ]);
        expect(result[1]).to.be.empty;
    });
});
