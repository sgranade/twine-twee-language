import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { buildInsertInfo } from "./inserts/insert-builders";
import { buildModifierInfo } from "./modifiers/modifier-builders";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import { DecorationType } from "../../../client-server";
import { ParseLevel } from "../../../parser";
import { TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../semantic-tokens";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/types";
import {
    ArgumentRequirement,
    ValueType,
} from "../../../passage-text-parsers/chapbook/types";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Parser", () => {
    it("should parse engine extension calls even when only parsing passage names", () => {
        const header = ":: Passage\n";
        const passage =
            "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi/}\n);\n});\n";
        const callbacks = new MockCallbacks();
        const state = buildParsingState({
            uri: "fake-uri",
            content: header + passage,
            callbacks: callbacks,
            parseLevel: ParseLevel.PassageNames,
        });
        state.storyFormat = {
            format: "Chapbook",
            formatVersion: "2.0.1",
        };
        const parser = uut.getChapbookParser(undefined);

        parser?.parsePassageText(passage, header.length, state);
        const result = callbacks.definitions[0] as ChapbookSymbol;

        expect(callbacks.definitions.length).to.equal(1);
        expect(ChapbookSymbol.is(result)).to.be.true;
        expect(result).to.eql({
            name: "hi",
            contents: "hi",
            location: Location.create("fake-uri", Range.create(4, 9, 4, 11)),
            kind: OChapbookSymbolKind.CustomInsert,
            match: /hi/,
        });
    });

    it("should parse a variable and property set in a vars section even when only parsing passage names", () => {
        const header = ":: Passage\n";
        const passage = "var1.prop: var2\n--\nThis is {var3}\n";
        const callbacks = new MockCallbacks();
        const state = buildParsingState({
            uri: "fake-uri",
            content: header + passage,
            callbacks: callbacks,
            parseLevel: ParseLevel.PassageNames,
        });
        state.storyFormat = {
            format: "Chapbook",
            formatVersion: "2.0.1",
        };
        const parser = uut.getChapbookParser(undefined);

        parser?.parsePassageText(passage, header.length, state);
        const result = callbacks.references;

        expect(callbacks.references.length).to.equal(2);
        expect(result[0]).to.eql({
            contents: "var1",
            location: Location.create("fake-uri", Range.create(1, 0, 1, 4)),
            kind: OChapbookSymbolKind.VariableSet,
        });
        expect(result[1]).to.eql({
            contents: "var1.prop",
            location: Location.create("fake-uri", Range.create(1, 5, 1, 9)),
            kind: OChapbookSymbolKind.PropertySet,
        });
    });

    it("should not parse engine extension calls when only parsing the StoryData passage", () => {
        const header = ":: Passage\n";
        const passage =
            "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi/}\n);\n});\n";
        const callbacks = new MockCallbacks();
        const state = buildParsingState({
            uri: "fake-uri",
            content: header + passage,
            callbacks: callbacks,
            parseLevel: ParseLevel.StoryData,
        });
        state.storyFormat = {
            format: "Chapbook",
            formatVersion: "2.0.1",
        };
        const parser = uut.getChapbookParser(undefined);

        parser?.parsePassageText(passage, header.length, state);

        expect(callbacks.definitions).to.be.empty;
    });

    describe("script passages", () => {
        it("should parse engine extension calls in script passages", () => {
            const header = ":: Passage [script]\n";
            const passage =
                "engine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi/}\n);\n});\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({ isScript: true });
            state.storyFormat = {
                format: "Chapbook",
                formatVersion: "2.0.1",
            };
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.definitions[0] as ChapbookSymbol;

            expect(callbacks.definitions.length).to.equal(1);
            expect(ChapbookSymbol.is(result)).to.be.true;
            expect(result).to.eql({
                name: "hi",
                contents: "hi",
                location: Location.create(
                    "fake-uri",
                    Range.create(3, 9, 3, 11)
                ),
                kind: OChapbookSymbolKind.CustomInsert,
                match: /hi/,
            });
        });

        it("should not parse vars in script passages", () => {
            const header = ":: Passage [script]\n";
            const passage = "\n var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({ isScript: true });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });
    });

    describe("vars section", () => {
        it("should capture decoration ranges for the vars section", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.decorationRanges;

            expect(result).to.eql([
                {
                    type: DecorationType.ChapbookVarsSection,
                    range: Range.create(1, 0, 2, 9999),
                },
            ]);
        });

        it("should capture a variable set reference for a variable name", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references[0];

            expect(callbacks.references.length).to.equal(1);
            expect(result).to.eql({
                contents: "var1",
                location: Location.create("fake-uri", Range.create(2, 1, 2, 5)),
                kind: OChapbookSymbolKind.VariableSet,
            });
        });

        it("should capture a variable set reference for a variable name with a dollar sign", () => {
            const header = ":: Passage\n";
            const passage = "\n$var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references[0];

            expect(callbacks.references.length).to.equal(1);
            expect(result).to.eql({
                contents: "$var1",
                location: Location.create("fake-uri", Range.create(2, 0, 2, 5)),
                kind: OChapbookSymbolKind.VariableSet,
            });
        });

        it("should capture references for a variable name and its property", () => {
            const header = ":: Passage\n";
            const passage = "\n var1.prop: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 1, 2, 5)
                    ),
                    kind: OChapbookSymbolKind.VariableSet,
                },
                {
                    contents: "var1.prop",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 6, 2, 10)
                    ),
                    kind: OChapbookSymbolKind.PropertySet,
                },
            ]);
        });

        it("should capture a reference for variables used in conditions", () => {
            const header = ":: Passage\n";
            const passage = "\n var_2 (var_1 || otherVar < 2): 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [result_0, result_1, result_2] = callbacks.references;

            expect(callbacks.references.length).to.equal(3);
            expect(result_0).to.eql({
                contents: "var_1",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 8, 2, 13)
                ),
                kind: OChapbookSymbolKind.Variable,
            });
            expect(result_1).to.eql({
                contents: "otherVar",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 17, 2, 25)
                ),
                kind: OChapbookSymbolKind.Variable,
            });
            expect(result_2).to.eql({
                contents: "var_2",
                location: Location.create("fake-uri", Range.create(2, 1, 2, 6)),
                kind: OChapbookSymbolKind.VariableSet,
            });
        });

        it("should set a semantic token for a variable name", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 1,
                length: 4,
                tokenType: ETokenType.variable,
                tokenModifiers: [ETokenModifier.modification],
            });
        });

        it("should set semantic token for a variable name and its property", () => {
            const header = ":: Passage\n";
            const passage = "\n var1.prop: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;
            expect(result[0]).to.eql({
                line: 2,
                char: 1,
                length: 4,
                tokenType: ETokenType.variable,
                tokenModifiers: [ETokenModifier.modification],
            });
            expect(result[1]).to.eql({
                line: 2,
                char: 6,
                length: 4,
                tokenType: ETokenType.property,
                tokenModifiers: [ETokenModifier.modification],
            });
        });

        it("should capture a reference for a variable's condition that itself contains a variable", () => {
            const header = ":: Passage\n";
            const passage = "\n var1 (var2): 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [result] = callbacks.references;

            expect(callbacks.references.length).to.equal(2);
            expect(result).to.eql({
                contents: "var2",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 7, 2, 11)
                ),
                kind: OChapbookSymbolKind.Variable,
            });
        });

        it("should set a semantic token for a variable's condition", () => {
            const header = ":: Passage\n";
            const passage = "\n var1 (true): 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [, result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 7,
                length: 4,
                tokenType: ETokenType.keyword,
                tokenModifiers: [],
            });
        });

        it("should set a semantic token for a variable's numeric value", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 17\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [, result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 7,
                length: 2,
                tokenType: ETokenType.number,
                tokenModifiers: [],
            });
        });

        it("should set a semantic token for a variable's string value", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 'hiya'\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [, result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 7,
                length: 6,
                tokenType: ETokenType.string,
                tokenModifiers: [],
            });
        });

        it("should set a semantic token for a variable's boolean value", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: true\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [, result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 7,
                length: 4,
                tokenType: ETokenType.keyword,
                tokenModifiers: [],
            });
        });

        it("should capture a reference for a variable's value that itself contains a variable", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 1 + var2\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references[1];

            expect(callbacks.references.length).to.equal(2);
            expect(result).to.eql({
                contents: "var2",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 11, 2, 15)
                ),
                kind: OChapbookSymbolKind.Variable,
            });
        });

        it("should not capture a reference for a variable's value that contains a namespace function", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: Math.floor(1.1)\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references[0];

            expect(callbacks.references.length).to.equal(1);
            expect(result).to.eql({
                contents: "var1",
                location: Location.create("fake-uri", Range.create(2, 1, 2, 5)),
                kind: OChapbookSymbolKind.VariableSet,
            });
        });

        it("should set a semantic token for a variable's value's operator", () => {
            const header = ":: Passage\n";
            const passage = "\n var1: 1 +\n--\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [, , result] = callbacks.tokens;

            expect(result).to.eql({
                line: 2,
                char: 9,
                length: 1,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
        });
    });

    describe("text section", () => {
        it("should create an embedded html document for the text section", () => {
            const header = ":: Passage\n";
            const passage = "var1: 17\n--\n[mock-mod]\nContent\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getChapbookParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.embeddedDocuments[0];

            expect(callbacks.embeddedDocuments.length).to.equal(1);
            expect(result.document.getText()).to.eql("[mock-mod]\nContent\n");
            expect(result.range).to.eql(Range.create(3, 0, 5, 0));
            expect(result.isPassage).to.be.true;
        });

        describe("modifiers", () => {
            describe("basic semantic tokens", () => {
                it("should set semantic tokens for known modifiers", () => {
                    const header = ":: Passage\n";
                    const passage = "[ mod1 ; mod1 nice  nice ]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const modifier = buildModifierInfo({
                        description: "My description!",
                        match: /^mod1/,
                    });
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [mod1Token, mod2Token, mod2Param1] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(3);
                    expect(mod1Token).to.eql({
                        line: 1,
                        char: 2,
                        length: 4,
                        tokenType: ETokenType.macro,
                        tokenModifiers: [],
                    });
                    expect(mod2Token).to.eql({
                        line: 1,
                        char: 9,
                        length: 4,
                        tokenType: ETokenType.macro,
                        tokenModifiers: [],
                    });
                    expect(mod2Param1).to.eql({
                        line: 1,
                        char: 14,
                        length: 10,
                        tokenType: ETokenType.parameter,
                        tokenModifiers: [],
                    });
                });

                it("should set semantic tokens for unknown modifiers", () => {
                    const header = ":: Passage\n";
                    const passage = "[ mod1 ; mod2 nice  nice ]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [mod1Token, mod2Token] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(2);
                    expect(mod1Token).to.eql({
                        line: 1,
                        char: 2,
                        length: 4,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(mod2Token).to.eql({
                        line: 1,
                        char: 9,
                        length: 15,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                });

                it("should indicate deprecation in a modifier's semantic token if applicable", () => {
                    const header = ":: Passage\n";
                    const passage = "[mod1]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const modifier = buildModifierInfo({
                        description: "My description!",
                        match: /^mod1/,
                    });
                    modifier.deprecated = "2.1";
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [mod1Token] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(mod1Token).to.eql({
                        line: 1,
                        char: 1,
                        length: 4,
                        tokenType: ETokenType.macro,
                        tokenModifiers: [ETokenModifier.deprecated],
                    });
                });

                it("should set semantic tokens for modifiers that take quote marks into account", () => {
                    const header = ":: Passage\n";
                    const passage = '[ mod1 "and\\"; so" ; mod2 ]\nContent\n';
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [mod1Token, mod2Token] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(2);
                    expect(mod1Token).to.eql({
                        line: 1,
                        char: 2,
                        length: 16,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(mod2Token).to.eql({
                        line: 1,
                        char: 21,
                        length: 4,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                });

                it("should set a comment token for a note modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "[ note ]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [token] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(2);
                    expect(token).to.eql({
                        line: 1,
                        char: 2,
                        length: 4,
                        tokenType: ETokenType.comment,
                        tokenModifiers: [],
                    });
                });

                it("should set a semantic token for a note modifier", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Content before\n" +
                        "[mod; n.b. ]\n" +
                        "A note\nMore note\n" +
                        "[continue]\nUnnoteable.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [modToken, nbToken, noteToken1, noteToken2] =
                        callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(5);
                    expect(modToken).to.eql({
                        line: 2,
                        char: 1,
                        length: 3,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(nbToken).to.eql({
                        line: 2,
                        char: 6,
                        length: 4,
                        tokenType: ETokenType.comment,
                        tokenModifiers: [],
                    });
                    expect(noteToken1).to.eql({
                        line: 3,
                        char: 0,
                        length: 6,
                        tokenType: ETokenType.comment,
                        tokenModifiers: [],
                    });
                    expect(noteToken2).to.eql({
                        line: 4,
                        char: 0,
                        length: 9,
                        tokenType: ETokenType.comment,
                        tokenModifiers: [],
                    });
                });
            });

            describe("contents parsing", () => {
                it("should capture a reference for a known modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[0];

                    expect(callbacks.references.length).to.equal(1);
                    expect(result).to.eql({
                        contents: "mock-mod",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 1, 1, 9)
                        ),
                        kind: OChapbookSymbolKind.BuiltInModifier,
                    });
                });

                it("should capture a reference for an unknown modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[0];

                    expect(callbacks.references.length).to.equal(1);
                    expect(result).to.eql({
                        contents: "mock-mod",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 1, 1, 9)
                        ),
                        kind: OChapbookSymbolKind.CustomModifier,
                    });
                });

                it("should capture folding ranges for modifiers", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[mock-mod]\r\nContent\r\n[othermod]\nMore stuff";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.foldingRanges;

                    expect(result).to.eql([
                        Range.create(1, 0, 2, 7),
                        Range.create(3, 0, 4, 10),
                    ]);
                });

                it("should capture folding ranges for modifiers that don't include a final \\r\\n", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[mock-mod]\nContent\n[othermod]\nMore stuff\r\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.foldingRanges;

                    expect(result).to.eql([
                        Range.create(1, 0, 2, 7),
                        Range.create(3, 0, 4, 10),
                    ]);
                });

                it("should not capture folding ranges for a [cont] modifier", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[mock-mod]\nContent\n[continue]\nMore stuff";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.foldingRanges;

                    expect(result).to.eql([Range.create(1, 0, 2, 7)]);
                });

                it("should capture decoration ranges for modifiers that aren't [cont] or [note]", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[mock-mod]\nContent\n[othermod]\nContent\n[continue]\nMore stuff\n[note]\nAnd more\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.decorationRanges;

                    expect(result).to.eql([
                        {
                            type: DecorationType.ChapbookModifierContent,
                            range: Range.create(2, 0, 2, 9999),
                        },
                        {
                            type: DecorationType.ChapbookModifierContent,
                            range: Range.create(4, 0, 4, 9999),
                        },
                    ]);
                });

                it("should send the full text to the matching modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod stuff that follows!]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    let passedText: string | undefined;
                    modifier.parse = (text: string) => {
                        passedText = text;
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(passedText).to.equal("mock-mod stuff that follows!");
                });

                it("should create a variable reference for a first arg that's an expression and contains a variable", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock mod tempy + other.prop]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock\s+mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.expression,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(4);
                    expect(result[1]).to.eql({
                        contents: "tempy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 10, 1, 15)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[2]).to.eql({
                        contents: "other",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 18, 1, 23)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[3]).to.eql({
                        contents: "other.prop",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 24, 1, 28)
                        ),
                        kind: OChapbookSymbolKind.Property,
                    });
                });

                it("should create a passage reference for a first arg that's a passage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'arg']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.passage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[1];

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 11, 1, 14)
                        ),
                        kind: TwineSymbolKind.Passage,
                    });
                });

                it("should create a passage semantic token for a first arg that's a passage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'arg']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.passage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 11,
                        length: 3,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });

                it("should create a passage reference for a non-link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'arg']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[1];

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 11, 1, 14)
                        ),
                        kind: TwineSymbolKind.Passage,
                    });
                });

                it("should create a passage semantic token for a non-link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'arg']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 11,
                        length: 3,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });

                it("should not create a passage reference for a link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'https://link.com']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(result.length).to.equal(1); // There should only be the reference to the modifier itself
                    expect(result[0].contents).to.eql("mock-mod");
                });

                it("should create a string semantic token for a non-link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod 'https://link.com']\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 10,
                        length: 18,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    });
                });

                it("should create variable and property references for a non-string first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod  arg.prop]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(3);
                    expect(result[1]).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 11, 1, 14)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[2]).to.eql({
                        contents: "arg.prop",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 15, 1, 19)
                        ),
                        kind: OChapbookSymbolKind.Property,
                    });
                });

                it("should create a variable semantic token for a non-string first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "[mock-mod  arg]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const modifier = buildModifierInfo({
                        match: /^mock-mod/,
                    });
                    modifier.firstArgument = {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 11,
                        length: 3,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                });

                it("should not capture variables in a javascript modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "Stuff\n\n[javascript]\n  newVar = 1;\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.references;

                    expect(result).to.eql([
                        {
                            contents: "javascript",
                            location: Location.create(
                                "fake-uri",
                                Range.create(3, 1, 3, 11)
                            ),
                            kind: OChapbookSymbolKind.BuiltInModifier,
                        },
                    ]);
                });

                it("should set an embedded document for a CSS modifier", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Content before\n" +
                        "[mod; cSs ]\n" +
                        "Fake CSS\nMore fake\n" +
                        "[continue]\nNot CSS.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    // The first embedded document is the entire passage
                    const [, result] = callbacks.embeddedDocuments;

                    expect(result.document.getText()).to.eql(
                        "Fake CSS\nMore fake\n"
                    );
                    expect(result.document.languageId).to.eql("css");
                    expect(result.range).to.eql(Range.create(3, 0, 5, 0));
                });

                it("should set a deferred embedded document for a JavaScript modifier", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Content before\n" +
                        "[mod; jAvAScrIpT ]\n" +
                        "let one = 2;\nconst three = 4;\n" +
                        "[continue]\nNot JavaScript.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    // The first embedded document is the entire passage
                    const [, result] = callbacks.embeddedDocuments;

                    expect(result.document.getText()).to.eql(
                        "let one = 2;\nconst three = 4;\n"
                    );
                    expect(result.document.languageId).to.eql("javascript");
                    expect(result.range).to.eql(Range.create(3, 0, 5, 0));
                    expect(result.deferToStoryFormat).to.be.true;
                });
            });
        });

        describe("links", () => {
            it("should produce no semantic tokens for an empty [[]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" + "Here it is: [[]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);

                expect(callbacks.tokens).to.be.empty;
            });

            it("should set semantic tokens for a [[target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [targetToken] = callbacks.tokens;

                expect(callbacks.tokens.length).to.equal(1);
                expect(targetToken).to.eql({
                    line: 2,
                    char: 15,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                });
            });

            it("should capture the passage reference for a [[target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 15, 2, 29)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should set semantic tokens for a [[display|target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string | target passage]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [displayToken, barToken, targetToken] = callbacks.tokens;

                expect(callbacks.tokens.length).to.equal(3);
                expect(displayToken).to.eql({
                    line: 2,
                    char: 14,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                });
                expect(barToken).to.eql({
                    line: 2,
                    char: 33,
                    length: 1,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                });
                expect(targetToken).to.eql({
                    line: 2,
                    char: 35,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                });
            });

            it("should capture the passage reference for a [[display|target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string | target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 35, 2, 49)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should set semantic tokens for a [[display->target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string -> target passage]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [displayToken, arrowToken, targetToken] =
                    callbacks.tokens;

                expect(callbacks.tokens.length).to.equal(3);
                expect(displayToken).to.eql({
                    line: 2,
                    char: 14,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                });
                expect(arrowToken).to.eql({
                    line: 2,
                    char: 33,
                    length: 2,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                });
                expect(targetToken).to.eql({
                    line: 2,
                    char: 36,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                });
            });

            it("should capture the passage reference for a [[display->target]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[display w a string -> target passage ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 36, 2, 50)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should set semantic tokens for a [[target<-display]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage <- display w a string ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [targetToken, arrowToken, displayToken] =
                    callbacks.tokens;

                expect(callbacks.tokens.length).to.equal(3);
                expect(targetToken).to.eql({
                    line: 2,
                    char: 15,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                });
                expect(arrowToken).to.eql({
                    line: 2,
                    char: 30,
                    length: 2,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                });
                expect(displayToken).to.eql({
                    line: 2,
                    char: 33,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                });
            });

            it("should capture the passage reference for a [[target<-display]] link", () => {
                const header = ":: Passage\n";
                const passage =
                    "We shall introduce: a link!\n" +
                    "Here it is: [[ target passage <- display w a string ]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "target passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 15, 2, 29)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });
        });

        describe("html", () => {
            it("should set an embedded document for an HTML style tag", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    "More content<style>\n" +
                    "  html {\n" +
                    "    margin: 1px;\n" +
                    "  }\n" +
                    "</style> And final content";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                // The first embedded document is the entire passage
                const [, result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql(
                    "\n  html {\n    margin: 1px;\n  }\n"
                );
                expect(result.document.languageId).to.eql("css");
                expect(result.range).to.eql(Range.create(2, 19, 6, 0));
            });

            it("should not set an index reference for an HTML style tag that contains curly braces", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    "More content<style>\n" +
                    "  html {\n" +
                    "    margin: 1px;\n" +
                    "  }\n" +
                    "</style> And final content";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.be.empty;
            });
        });

        describe("inserts", () => {
            describe("basic semantic tokens", () => {
                it("should produce semantic tokens for a variable insert", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" + "A variable insert: { varbl  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [insertToken] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(insertToken).to.eql({
                        line: 2,
                        char: 21,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                });

                it("should produce semantic tokens for a simple insert", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: { back soon  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [functionToken] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 21,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                });

                it("should indicate deprecation in a simple insert's semantic token when applicable", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" + "A function insert: {back soon}.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const insert = buildInsertInfo({
                        match: /^back soon/,
                    });
                    insert.deprecated = "2.1";
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [functionToken] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 20,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [ETokenModifier.deprecated],
                    });
                });

                it("should produce semantic tokens for an insert with an empty argument", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: {back soon: }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [functionToken] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 20,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                });

                it("should produce semantic tokens for an insert with an argument", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: { back soon: 'arg'  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.tokens.length).to.equal(2);
                    expect(callbacks.tokens[0]).to.eql({
                        line: 2,
                        char: 21,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(callbacks.tokens[1]).to.eql({
                        line: 2,
                        char: 32,
                        length: 5,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    });
                });

                it("should produce semantic tokens for an insert with an incomplete property", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: {back soon, prop}.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [functionToken] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(1);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 20,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                });

                it("should produce semantic tokens for an insert with properties", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: { back soon,  prop1: val1, prop2 : 'val2'  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [
                        functionToken,
                        prop1NameToken,
                        prop1ValueToken,
                        prop2NameToken,
                        prop2ValueToken,
                    ] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(5);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 21,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(prop1NameToken).to.eql({
                        line: 2,
                        char: 33,
                        length: 5,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    });
                    expect(prop1ValueToken).to.eql({
                        line: 2,
                        char: 40,
                        length: 4,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                    expect(prop2NameToken).to.eql({
                        line: 2,
                        char: 46,
                        length: 5,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    });
                    expect(prop2ValueToken).to.eql({
                        line: 2,
                        char: 54,
                        length: 6,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    });
                });

                it("should produce semantic tokens for an insert with an arg and properties", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A function insert: { back soon: arg,  prop1: val1, prop2 : val2  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [
                        functionToken,
                        firstArgToken,
                        p1NameToken,
                        p1ValToken,
                        p2NameToken,
                        p2ValToken,
                    ] = callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(6);
                    expect(functionToken).to.eql({
                        line: 2,
                        char: 21,
                        length: 9,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(firstArgToken).to.eql({
                        line: 2,
                        char: 32,
                        length: 3,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                    expect(p1NameToken).to.eql({
                        line: 2,
                        char: 38,
                        length: 5,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    });
                    expect(p1ValToken).to.eql({
                        line: 2,
                        char: 45,
                        length: 4,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                    expect(p2NameToken).to.eql({
                        line: 2,
                        char: 51,
                        length: 5,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    });
                    expect(p2ValToken).to.eql({
                        line: 2,
                        char: 59,
                        length: 4,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                });
            });

            describe("semantic token order", () => {
                it("should interleave tokens in document order", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Link: [[target]] insert {varbl} another link [[target2]].";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [target1Token, varToken, target2Token] =
                        callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(3);
                    expect(target1Token).to.eql({
                        line: 1,
                        char: 8,
                        length: 6,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                    expect(varToken).to.eql({
                        line: 1,
                        char: 25,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                    expect(target2Token).to.eql({
                        line: 1,
                        char: 47,
                        length: 7,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });
            });

            describe("contents parsing", () => {
                it("should capture a variable reference for a variable insert", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Some content.\n" +
                        "A variable insert: { var1.prop  }.\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql([
                        {
                            contents: "var1",
                            location: Location.create(
                                "fake-uri",
                                Range.create(2, 21, 2, 25)
                            ),
                            kind: OChapbookSymbolKind.Variable,
                        },
                        {
                            contents: "var1.prop",
                            location: Location.create(
                                "fake-uri",
                                Range.create(2, 26, 2, 30)
                            ),
                            kind: OChapbookSymbolKind.Property,
                        },
                    ]);
                });

                it("should capture a reference for a known insert", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[0];

                    expect(callbacks.references.length).to.equal(1);
                    expect(result).to.eql({
                        contents: "mock insert",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 9, 1, 20)
                        ),
                        kind: OChapbookSymbolKind.BuiltInInsert,
                    });
                });

                it("should capture a reference for an unknown insert", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[0];

                    expect(callbacks.references.length).to.equal(1);
                    expect(result).to.eql({
                        contents: "mock insert",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 9, 1, 20)
                        ),
                        kind: OChapbookSymbolKind.CustomInsert,
                    });
                });

                it("should capture a variable reference in an insert's first arg", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  arg}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.references;

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 26)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                });

                it("should send the first arg to the matching insert", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg'",
                        at: 34,
                    });
                    expect(allTokens[0].props).to.be.empty;
                });

                it("should handle multiple inserts in a row on the same line", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert: 'arg}'} {mock insert: 'arg{'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(2);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg}'",
                        at: 33,
                    });
                    expect(allTokens[0].props).to.be.empty;
                    expect(allTokens[1].firstArgument).to.eql({
                        text: "'arg{'",
                        at: 55,
                    });
                    expect(allTokens[1].props).to.be.empty;
                });

                it("should handle first args that have } in a string", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg}'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg}'",
                        at: 34,
                    });
                    expect(allTokens[0].props).to.be.empty;
                });

                it("should handle first args that have { in a string", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg{'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg{'",
                        at: 34,
                    });
                    expect(allTokens[0].props).to.be.empty;
                });

                it("should handle first args that have an escaped quote mark in a string", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg\\''}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg\\''",
                        at: 34,
                    });
                    expect(allTokens[0].props).to.be.empty;
                });

                it("should create a variable reference for a first arg that's an expression and contains a variable", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  tempy.prop}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.expression;
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(3);
                    expect(result[0]).to.eql({
                        contents: "tempy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 28)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[1]).to.eql({
                        contents: "tempy.prop",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 29, 1, 33)
                        ),
                        kind: OChapbookSymbolKind.Property,
                    });
                });

                it("should create a passage reference for a first arg that's a passage", () => {
                    const header = ":: Passage\n";
                    const passage = 'Insert: {mock insert:  "arg"}';
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.passage;
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[1];

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 24, 1, 27)
                        ),
                        kind: TwineSymbolKind.Passage,
                    });
                });

                it("should create a passage semantic token for a first arg that's a passage", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.passage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 24,
                        length: 3,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });

                it("should create a passage reference for a non-link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references[1];

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 24, 1, 27)
                        ),
                        kind: TwineSymbolKind.Passage,
                    });
                });

                it("should create a passage semantic token for a non-link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 24,
                        length: 3,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });

                it("should not create a passage reference for a link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert:  'https://link.com'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(result.length).to.equal(1); // There should only be the reference to the insert itself
                    expect(result[0].contents).to.eql("mock insert");
                });

                it("should create a string semantic token for a link first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert:  'https://link.com'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 23,
                        length: 18,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    });
                });

                it("should create a variable reference for a non-string first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  arg.prop}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(3);
                    expect(result[0]).to.eql({
                        contents: "arg",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 26)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[1]).to.eql({
                        contents: "arg.prop",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 27, 1, 31)
                        ),
                        kind: OChapbookSymbolKind.Property,
                    });
                });

                it("should create a variable semantic token for a non-string first arg that's a urlOrPassage", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert:  arg}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.firstArgument.type = ValueType.urlOrPassage;
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, firstArgToken] = callbacks.tokens;

                    expect(firstArgToken).to.eql({
                        line: 1,
                        char: 23,
                        length: 3,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    });
                });

                it("should create a variable reference for a property that's a variable", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert:  'arg', prop1: var1.prop }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.requiredProps = {
                        prop1: {
                            placeholder: "",
                            type: ValueType.passage,
                        },
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.references;

                    expect(callbacks.references.length).to.equal(3);
                    expect(result[0]).to.eql({
                        contents: "var1",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 37, 1, 41)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
                    expect(result[1]).to.eql({
                        contents: "var1.prop",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 42, 1, 46)
                        ),
                        kind: OChapbookSymbolKind.Property,
                    });
                });

                it("should create a passage semantic token for a property that's a passage", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert:  'arg', prop1: 'yes', prop2: 'no'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    insert.requiredProps = {
                        prop1: {
                            placeholder: "",
                            type: ValueType.passage,
                        },
                    };
                    insert.optionalProps = {
                        prop2: {
                            placeholder: "",
                            type: ValueType.passage,
                        },
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [, , , firstPropValueToken, , secondPropValueToken] =
                        callbacks.tokens;

                    expect(firstPropValueToken).to.eql({
                        line: 1,
                        char: 38,
                        length: 3,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                    expect(secondPropValueToken).to.eql({
                        line: 1,
                        char: 52,
                        length: 2,
                        tokenType: ETokenType.class,
                        tokenModifiers: [],
                    });
                });

                it("should send all properties to the matching insert", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert ,  prop1: ['yes, yes', 'yup'], prop2: 'no'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.be.undefined;
                    expect(allTokens[0].props).to.eql({
                        prop1: [
                            { text: "prop1", at: 35 },
                            { text: "['yes, yes', 'yup']", at: 42 },
                        ],
                        prop2: [
                            { text: "prop2", at: 63 },
                            { text: "'no'", at: 70 },
                        ],
                    });
                });

                it("should send all contents to the matching insert", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Insert: {mock insert: 'arg', prop1: 'yes', prop2: 'no'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const allTokens: insertsModule.InsertTokens[] = [];
                    insert.parse = (tokens) => {
                        allTokens.push(tokens);
                    };
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(allTokens.length).to.equal(1);
                    expect(allTokens[0].firstArgument).to.eql({
                        text: "'arg'",
                        at: 33,
                    });
                    expect(allTokens[0].props).to.eql({
                        prop1: [
                            { text: "prop1", at: 40 },
                            { text: "'yes'", at: 47 },
                        ],
                        prop2: [
                            { text: "prop2", at: 54 },
                            { text: "'no'", at: 61 },
                        ],
                    });
                });
            });
        });

        describe("engine extensions", () => {
            it("should capture a symbol definition for a custom insert", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set the symbol definition's name to the name property for a custom insert", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, name: 'hi there'}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi there",
                    contents: "hi there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set the symbol definition's description to the description property for a custom insert", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, description: 'I am an insert!'}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    description: "I am an insert!",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set the symbol definition's syntax to the syntax property for a custom insert", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, syntax: '{hi there}'}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    syntax: "{hi there}",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set the symbol definition's completions to the completions property for a custom insert with a single string completion", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, completions: 'one'}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    completions: ["one"],
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set the symbol definition's completions to the completions property for a custom insert with an array of strings completion", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, completions: ['one', 'two']}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    completions: ["one", "two"],
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom insert's symbol definition's first argument as required if boolean true", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument as optional if boolean false", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: false }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument as required if set to 'required'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'required' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument as optional if set to 'optional'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'optional' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument as ignored if set to 'ignored'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'ignored' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument's placeholder if set in the file", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, placeholder: \"'arg'\" }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'arg'",
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument's type as an expression if set to 'expression'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, type: 'expression' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        type: ValueType.expression,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument's type as a number if set to 'number'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, type: 'number' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        type: ValueType.number,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument's type as a passage if set to 'passage'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, type: 'passage' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        type: ValueType.passage,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's first argument's type as urlOrPassage if set to 'urlOrPassage'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, type: 'urlOrPassage' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        type: ValueType.urlOrPassage,
                    },
                    requiredProps: {},
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's required properties and placeholders if set in the file", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true },\nrequiredProps: {\nfoo: null, bar: \"'bar'\", baz: {type: 'number', placeholder: '3'}\n}\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {
                        foo: null,
                        bar: "'bar'",
                        baz: {
                            type: ValueType.number,
                            placeholder: "3",
                        },
                    },
                    optionalProps: {},
                });
            });

            it("should set a custom insert's symbol definition's optional properties and placeholders if set in the file", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true },\noptionalProps: {\nfoo: null, bar: \"'bar'\", baz: {type: 'number', placeholder: '3'}\n}\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                    requiredProps: {},
                    optionalProps: {
                        foo: null,
                        bar: "'bar'",
                        baz: {
                            type: ValueType.number,
                            placeholder: "3",
                        },
                    },
                });
            });

            it("should capture symbol definitions for multiple custom inserts in a passage", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\n" +
                    "engine.extend('2.0.1', () => {\n" +
                    "engine.template.inserts.add(\n" +
                    "{match: /hi\\s+there/}\n" +
                    ");\n" +
                    "});\n" +
                    "engine.extend('2.0.1', () => {\n" +
                    "engine.template.inserts.add(\n" +
                    "{match: /different\\s+insert/}\n" +
                    ");\n" +
                    "});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result0, result1] =
                    callbacks.definitions as ChapbookSymbol[];

                expect(callbacks.definitions.length).to.equal(2);
                expect(ChapbookSymbol.is(result0)).to.be.true;
                expect(result0).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /hi\s+there/,
                });
                expect(ChapbookSymbol.is(result1)).to.be.true;
                expect(result1).to.eql({
                    name: "different\\s+insert",
                    contents: "different\\s+insert",
                    location: Location.create(
                        "fake-uri",
                        Range.create(9, 9, 9, 27)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /different\s+insert/,
                });
            });

            it("should capture a symbol definition for a custom modifier", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's name to the name property", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, name: \"hi there\"}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi there",
                    contents: "hi there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's description to the description property", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, description: \"I'm a modifier!\"}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    description: "I'm a modifier!",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's syntax to the syntax property", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, syntax: \"[hi there]\"}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    syntax: "[hi there]",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's completions to the completions property for a single string", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, completions: \"one\"}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    completions: ["one"],
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's completions to the completions property for an array of strings", () => {
                const header = ":: Passage\n";
                const passage =
                    '[javascript]\nengine.extend(\'2.0.1\', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, completions: ["one", "two"]}\n);\n});\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    completions: ["one", "two"],
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                });
            });

            it("should set a custom modifier symbol definition's first argument as required if boolean true", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                });
            });

            it("should set a custom modifier symbol definition's first argument as optional if boolean false", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: false }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                    },
                });
            });

            it("should set a custom modifier symbol definition's first argument as required if set to 'required'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'required' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                    },
                });
            });

            it("should set a custom modifier symbol definition's first argument as optional if set to 'optional'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'optional' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.optional,
                    },
                });
            });

            it("should set a custom modifier symbol definition's first argument as ignored if set to 'ignored'", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: 'ignored' }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.ignored,
                    },
                });
            });

            it("should set a custom modifier symbol definition's first argument's placeholder", () => {
                const header = ":: Passage\n";
                const passage =
                    "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/, arguments: {\nfirstArgument: { required: true, placeholder: \"'arg'\" }\n}}\n);\n});\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "Chapbook",
                    formatVersion: "2.0.1",
                };
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.definitions[0] as ChapbookSymbol;

                expect(callbacks.definitions.length).to.equal(1);
                expect(ChapbookSymbol.is(result)).to.be.true;
                expect(result).to.eql({
                    name: "hi\\s+there",
                    contents: "hi\\s+there",
                    location: Location.create(
                        "fake-uri",
                        Range.create(4, 9, 4, 19)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /hi\s+there/,
                    firstArgument: {
                        required: ArgumentRequirement.required,
                        placeholder: "'arg'",
                    },
                });
            });
        });
    });

    describe("errors", () => {
        describe("vars section", () => {
            it("should warn on a missing colon", () => {
                const header = ":: Passage\n";
                const passage = "var0: right\nvar1 = wrong\n--\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include("Missing colon");
                expect(result.range).to.eql(Range.create(2, 0, 2, 12));
            });

            it("should warn on a missing colon even on Windows", () => {
                const header = ":: Passage\r\n";
                const passage = "var0: right\r\nvar1 = wrong\r\n--\r\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include("Missing colon");
                expect(result.range).to.eql(Range.create(2, 0, 2, 12));
            });

            it("should error on spaces before a colon", () => {
                const header = ":: Passage\n";
                const passage = "var1 nope: 17\n--\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Variable names can't have spaces"
                );
                expect(result.range).to.eql(Range.create(1, 4, 1, 5));
            });

            it("should error on an unclosed parenthesis before a colon", () => {
                const header = ":: Passage\n";
                const passage = "var(cond: 17\n--\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Missing a close parenthesis"
                );
                expect(result.range).to.eql(Range.create(1, 8, 1, 8));
            });

            it("should warn on text after a condition parentheses but before the colon", () => {
                const header = ":: Passage\n";
                const passage = "var (cond) ignored: 17\n--\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include("This will be ignored");
                expect(result.range).to.eql(Range.create(1, 11, 1, 18));
            });
        });

        describe("text section", () => {
            describe("modifiers", () => {
                it("should error on a modifier when the story format's version is earlier than when the modifier was added to Chapbook", () => {
                    const header = ":: Passage\n";
                    const passage = "var1: 17\n--\n" + "[mod]\nOther text\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const modifier = buildModifierInfo({
                        name: "modMe",
                        match: /^mod/,
                    });
                    modifier.since = "2.1.1";
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "`modMe` isn't available until Chapbook version 2.1.1 but your StoryFormat version is 2.1"
                    );
                    expect(result.range).to.eql(Range.create(3, 1, 3, 4));
                });

                it("should error on a modifier when the story format's version is later than when the modifier was removed from Chapbook", () => {
                    const header = ":: Passage\n";
                    const passage = "var1: 17\n--\n" + "[mod]\nOther text\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const modifier = buildModifierInfo({
                        name: "modMe",
                        match: /^mod/,
                    });
                    modifier.removed = "2.1";
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "`modMe` was removed in Chapbook version 2.1 and your StoryFormat version is 2.1"
                    );
                    expect(result.range).to.eql(Range.create(3, 1, 3, 4));
                });

                it("should error on spaces before modifiers", () => {
                    const header = ":: Passage\n";
                    const passage = "var1: 17\n--\n" + "  [note]\nOther text\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Modifiers can't have spaces before them"
                    );
                    expect(result.range).to.eql(Range.create(3, 0, 3, 2));
                });

                it("should error on spaces after modifiers", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "var1: 17\n--\n" + " [note]  \nOther text\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [, result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(2);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Modifiers can't have spaces after them"
                    );
                    expect(result.range).to.eql(Range.create(3, 7, 3, 9));
                });

                it("should not error on blank lines before or after modifiers", () => {
                    const header = ":: Passage\n";
                    const passage = "var1: 17\n--\n" + "\n[note]\nOther text\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors).to.be.empty;
                });

                it("should not error on Windows blank lines before or after modifiers", () => {
                    const header = ":: Passage\r\n";
                    const passage =
                        "var1: 17\r\n--\r\n" + "\r\n[note]\r\nOther text\r\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors).to.be.empty;
                });
            });

            describe("inserts", () => {
                it("should error on an insert when the story format's version is earlier than when the modifier was added to Chapbook", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "var1: 17\n--\n" + "Let's go: {fn insert}\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const insert = buildInsertInfo({
                        name: "fn insert",
                        match: /^fn\s+insert/i,
                    });
                    insert.since = "2.1.1";
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "`fn insert` isn't available until Chapbook version 2.1.1 but your StoryFormat version is 2.1"
                    );
                    expect(result.range).to.eql(Range.create(3, 11, 3, 20));
                });

                it("should error on an insert when the story format's version is later than when the insert was removed from Chapbook", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "var1: 17\n--\n" + "Let's go: {fn insert}\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1",
                    };
                    const parser = uut.getChapbookParser("2.1");
                    const insert = buildInsertInfo({
                        name: "fn insert",
                        match: /^fn\s+insert/i,
                    });
                    insert.removed = "2.1";
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "`fn insert` was removed in Chapbook version 2.1 and your StoryFormat version is 2.1"
                    );
                    expect(result.range).to.eql(Range.create(3, 11, 3, 20));
                });

                it("should error on an array dereference in the middle of a var insert", () => {
                    const header = ":: Passage\r\n";
                    const passage =
                        "var1: 17\r\n--\r\n" + " {var[0].color}  \r\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Array dereferencing can only be at the end"
                    );
                    expect(result.range).to.eql(Range.create(3, 5, 3, 8));
                });

                it("should error on a function insert whose property has spaces", () => {
                    const header = ":: Passage\n";
                    const passage = " {fn insert, bad prop: 1}  \n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Properties can't have spaces"
                    );
                    expect(result.range).to.eql(Range.create(1, 13, 1, 21));
                });

                it("should not error on a function insert whose first arg is an array", () => {
                    const header = ":: Passage\n";
                    const passage =
                        " {fn insert: ['has space', 'as does this', 'and this'], prop: 2}  \n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors).to.be.empty;
                });

                it("should flag a property with a space", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert, prop 1 a: 'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Properties can't have spaces"
                    );
                    expect(result.range).to.eql(Range.create(1, 22, 1, 30));
                });

                it("should flag a missing required first argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                        firstArgRequired: ArgumentRequirement.required,
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "`Mock Insert` requires a first argument"
                    );
                    expect(result.range).to.eql(Range.create(1, 10, 1, 21));
                });

                it("should warn about an ignored first argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert: 'arg' }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                        firstArgRequired: ArgumentRequirement.ignored,
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "`Mock Insert` will ignore this first argument"
                    );
                    expect(result.range).to.eql(Range.create(1, 23, 1, 28));
                });

                it("should flag a missing required property", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                        requiredProps: { expected: null, also: null },
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Insert {Mock Insert} missing expected properties: expected, also"
                    );
                    expect(result.range).to.eql(Range.create(1, 10, 1, 21));
                });

                it("should not flag missing optional properties", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                        optionalProps: { expected: null, also: null },
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

                    expect(callbacks.errors.length).to.equal(0);
                });

                it("should warn about unexpected properties", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert, nope: 2 }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertInfo({
                        match: /^mock insert/,
                        optionalProps: { unneeded: null },
                    });
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const mockFunction = ImportMock.mockFunction(
                        insertsModule,
                        "all"
                    ).returns([insert]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Insert {Mock Insert} will ignore this property"
                    );
                    expect(result.range).to.eql(Range.create(1, 23, 1, 27));
                });
            });

            describe("engine extensions", () => {
                it("should error on engine extensions whose version isn't a number", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('bork', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "The extension's version must be a number like '2.0.0'"
                    );
                    expect(result.range).to.eql(Range.create(2, 15, 2, 19));
                });

                it("should not warn on engine extensions if the story format doesn't have a version", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.0', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors.length).to.equal(0);
                });

                it("should warn on engine extensions whose version is greater than the story format's version", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.1.17', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "The current story format version is 2.0.1, so this extension will be ignored"
                    );
                    expect(result.range).to.eql(Range.create(2, 15, 2, 21));
                });

                it("should not warn on engine extensions whose version is less than the story format's version", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.1.1', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.1.17",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(0);
                });

                it("should warn on engine extensions whose version is less than and shorter than the story format's version", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "The current story format version is 2.0, so this extension will be ignored"
                    );
                    expect(result.range).to.eql(Range.create(2, 15, 2, 20));
                });

                it("should not warn on engine extensions whose version is greater than and shorter than the story format's version", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0', true);\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors).to.be.empty;
                });

                it("should warn on engine extensions that aren't extending inserts or modifiers", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.nope.add();\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Unrecognized engine template function"
                    );
                    expect(result.range).to.eql(Range.create(3, 0, 3, 20));
                });

                it("should error on a custom insert with a non-regex match object", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: 1}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Must be a regular expression"
                    );
                    expect(result.range).to.eql(Range.create(4, 8, 4, 9));
                });

                it("should error on a custom insert with no space in its match object", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi/}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Custom inserts must have a space in their match"
                    );
                    expect(result.range).to.eql(Range.create(4, 9, 4, 11));
                });

                it("should not error on a custom insert with a space regex metacharacter in its match object", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\sthere/}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors).to.be.empty;
                });

                it("should warn on a custom insert with a non-string name", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, \nname: 1}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include("Must be a string");
                    expect(result.range).to.eql(Range.create(5, 6, 5, 7));
                });

                it("should warn on a custom insert with a non-string description", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, \ndescription: 1}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include("Must be a string");
                    expect(result.range).to.eql(Range.create(5, 13, 5, 14));
                });

                it("should warn on a custom insert with a non-string syntax", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, \nsyntax: 1}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include("Must be a string");
                    expect(result.range).to.eql(Range.create(5, 8, 5, 9));
                });

                it("should warn on a custom insert with non-string completions", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, completions: 1}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Completions must be a string or an array of strings"
                    );
                    expect(result.range).to.eql(Range.create(4, 35, 4, 36));
                });

                it("should warn on a custom insert with non-strings in its array of completions", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi\\s+there/, completions: [1, 'two']}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Completions must be a string or an array of strings"
                    );
                    expect(result.range).to.eql(Range.create(4, 36, 4, 37));
                });

                it("should warn on a custom modifier with requiredProps", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/,\narguments: {\nrequiredProps: {\nfoo: null\n}\n}\n}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "requiredProps are ignored for a custom modifier"
                    );
                    expect(result.range).to.eql(Range.create(6, 0, 6, 13));
                });

                it("should warn on a custom modifier with optionalProps", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi\\s+there/,\narguments: {\noptionalProps: {\nfoo: null\n}\n}\n}\n);\n});\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        uri: "fake-uri",
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    state.storyFormat = {
                        format: "Chapbook",
                        formatVersion: "2.0.1",
                    };
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "optionalProps are ignored for a custom modifier"
                    );
                    expect(result.range).to.eql(Range.create(6, 0, 6, 13));
                });
            });
        });
    });
});
