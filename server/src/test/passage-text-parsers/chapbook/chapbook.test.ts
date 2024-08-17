import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    MarkupKind,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { buildInsertInfo } from "./inserts/insert-builders";
import { buildModifierInfo } from "./modifiers/modifier-builders";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import { ParseLevel } from "../../../parser";
import { Index, TwineSymbolKind } from "../../../project-index";
import { defaultDiagnosticsOptions } from "../../../server-options";
import { ETokenModifier, ETokenType } from "../../../tokens";
import {
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/chapbook-parser";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";

import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook", () => {
    describe("Parsing", () => {
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
                contents: "hi",
                location: Location.create(
                    "fake-uri",
                    Range.create(4, 9, 4, 11)
                ),
                kind: OChapbookSymbolKind.CustomInsert,
                match: /hi/,
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

        describe("vars section", () => {
            it("should capture a reference for a variable name", () => {
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
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 1, 2, 5)
                    ),
                    kind: OChapbookSymbolKind.Variable,
                });
            });

            it("should capture a reference for a variable name but not its referenced property", () => {
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
                const result = callbacks.references[0];

                expect(callbacks.references.length).to.equal(1);
                expect(result).to.eql({
                    contents: "var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 1, 2, 5)
                    ),
                    kind: OChapbookSymbolKind.Variable,
                });
            });

            it("should capture reference for variables used in conditions", () => {
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
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 1, 2, 6)
                    ),
                    kind: OChapbookSymbolKind.Variable,
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
                    tokenModifiers: [],
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
                expect(result.document.getText()).to.eql(
                    "[mock-mod]\nContent\n"
                );
                expect(result.range).to.eql(Range.create(3, 0, 5, 0));
                expect(result.isPassage).to.be.true;
            });

            describe("modifiers", () => {
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

                it("should set semantic tokens for modifiers", () => {
                    const header = ":: Passage\n";
                    const passage = "[ mod1 ; mod2 nice  nice ]\nContent\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [mod1Token, mod2Token, mod2Param1, mod2Param2] =
                        callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(4);
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
                        length: 4,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(mod2Param1).to.eql({
                        line: 1,
                        char: 14,
                        length: 4,
                        tokenType: ETokenType.parameter,
                        tokenModifiers: [],
                    });
                    expect(mod2Param2).to.eql({
                        line: 1,
                        char: 20,
                        length: 4,
                        tokenType: ETokenType.parameter,
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
                        tokenType: ETokenType.function,
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
                    const [mod1Token, mod1Param1, mod1Param2, mod2Token] =
                        callbacks.tokens;

                    expect(callbacks.tokens.length).to.equal(4);
                    expect(mod1Token).to.eql({
                        line: 1,
                        char: 2,
                        length: 4,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    });
                    expect(mod1Param1).to.eql({
                        line: 1,
                        char: 7,
                        length: 7,
                        tokenType: ETokenType.parameter,
                        tokenModifiers: [],
                    });
                    expect(mod1Param2).to.eql({
                        line: 1,
                        char: 15,
                        length: 3,
                        tokenType: ETokenType.parameter,
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

                it("should capture variables in a javascript modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "Stuff\n\n[javascript]\n  newVar = 1;\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [, result] = callbacks.references;

                    expect(callbacks.references.length).to.equal(2);
                    expect(result).to.eql({
                        contents: "newVar",
                        location: Location.create(
                            "fake-uri",
                            Range.create(4, 2, 4, 8)
                        ),
                        kind: OChapbookSymbolKind.Variable,
                    });
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
                    const [displayToken, barToken, targetToken] =
                        callbacks.tokens;

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
                            "Some content.\n" +
                            "A variable insert: { var  }.\n";
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
                            length: 3,
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
                            "Some content.\n" +
                            "A function insert: {back soon}.\n";
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
                            "Link: [[target]] insert {var} another link [[target2]].";
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
                            length: 3,
                            tokenType: ETokenType.variable,
                            tokenModifiers: [],
                        });
                        expect(target2Token).to.eql({
                            line: 1,
                            char: 45,
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
                            "A variable insert: { var.prop  }.\n";
                        const callbacks = new MockCallbacks();
                        const state = buildParsingState({
                            content: header + passage,
                            callbacks: callbacks,
                        });
                        const parser = uut.getChapbookParser(undefined);

                        parser?.parsePassageText(passage, header.length, state);
                        const [result] = callbacks.references;

                        expect(callbacks.references.length).to.equal(1);
                        expect(result).to.eql({
                            contents: "var",
                            location: Location.create(
                                "fake-uri",
                                Range.create(2, 21, 2, 24)
                            ),
                            kind: OChapbookSymbolKind.Variable,
                        });
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

                    it("should create a passage reference for a first arg that's a passage", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  'arg'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertInfo({
                            match: /^mock insert/,
                        });
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.passage;
                        const allTokens: insertsModule.InsertTokens[] = [];
                        insert.parse = (tokens) => {
                            allTokens.push(tokens);
                        };
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
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.passage;
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
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
                        const allTokens: insertsModule.InsertTokens[] = [];
                        insert.parse = (tokens) => {
                            allTokens.push(tokens);
                        };
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
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
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
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
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
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
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
                        const passage = "Insert: {mock insert:  arg}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertInfo({
                            match: /^mock insert/,
                        });
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
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

                    it("should create a variable semantic token for a non-string first arg that's a urlOrPassage", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  arg}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertInfo({
                            match: /^mock insert/,
                        });
                        insert.arguments.firstArgument.type =
                            insertsModule.ValueType.urlOrPassage;
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
                            "Insert: {mock insert:  'arg', prop1: var }";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertInfo({
                            match: /^mock insert/,
                        });
                        insert.arguments.requiredProps = {
                            prop1: {
                                placeholder: "",
                                type: insertsModule.ValueType.passage,
                            },
                        };
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
                        const [result] = callbacks.references;

                        expect(callbacks.references.length).to.equal(2);
                        expect(result).to.eql({
                            contents: "var",
                            location: Location.create(
                                "fake-uri",
                                Range.create(1, 37, 1, 40)
                            ),
                            kind: OChapbookSymbolKind.Variable,
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
                        insert.arguments.requiredProps = {
                            prop1: {
                                placeholder: "",
                                type: insertsModule.ValueType.passage,
                            },
                        };
                        insert.arguments.optionalProps = {
                            prop2: {
                                placeholder: "",
                                type: insertsModule.ValueType.passage,
                            },
                        };
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
                        const [
                            ,
                            ,
                            ,
                            firstPropValueToken,
                            ,
                            secondPropValueToken,
                        ] = callbacks.tokens;

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

                it("should set the symbol definition's completions to the completions property for a custom insert", () => {
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
                        contents: "hi\\s+there",
                        location: Location.create(
                            "fake-uri",
                            Range.create(4, 9, 4, 19)
                        ),
                        kind: OChapbookSymbolKind.CustomModifier,
                        match: /hi\s+there/,
                    });
                });

                it("should set the symbol definition's name to the name property for a custom modifier", () => {
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
                        contents: "hi there",
                        location: Location.create(
                            "fake-uri",
                            Range.create(4, 9, 4, 19)
                        ),
                        kind: OChapbookSymbolKind.CustomModifier,
                        match: /hi\s+there/,
                    });
                });

                it("should set the symbol definition's description to the description property for a custom modifier", () => {
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

                it("should set the symbol definition's syntax to the syntax property for a custom modifier", () => {
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

                it("should set the symbol definition's completions to the completions property for a custom modifier", () => {
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

                it("should error on a variable with a bad first character", () => {
                    const header = ":: Passage\n";
                    const passage = " 1var : 17\n--\n";
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
                        "Variable names must start with a letter, $, or _"
                    );
                    expect(result.range).to.eql(Range.create(1, 1, 1, 2));
                });

                it("should error on a variable with illegal characters", () => {
                    const header = ":: Passage\n";
                    const passage = " väur😊 : 17\n--\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.errors;

                    expect(result.length).to.equal(2);
                    expect(result[0].severity).to.eql(DiagnosticSeverity.Error);
                    expect(result[0].message).to.include(
                        "Must be a letter, digit, $, or _"
                    );
                    expect(result[0].range).to.eql(Range.create(1, 2, 1, 3));
                    expect(result[1].severity).to.eql(DiagnosticSeverity.Error);
                    expect(result[1].message).to.include(
                        "Must be a letter, digit, $, or _"
                    );
                    // Note that this looks like 2 characters b/c of UTF-16 encoding of the smilie face
                    expect(result[1].range).to.eql(Range.create(1, 5, 1, 7));
                });

                it("should not error on a variable with a dot", () => {
                    const header = ":: Passage\n";
                    const passage = " var.sub : 17\n--\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);

                    expect(callbacks.errors).to.be.empty;
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
                        const passage =
                            "var1: 17\n--\n" + "[mod]\nOther text\n";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Modifier [modMe] isn't available until Chapbook version 2.1.1 but your StoryFormat version is 2.1"
                        );
                        expect(result.range).to.eql(Range.create(3, 1, 3, 4));
                    });

                    it("should error on a modifier when the story format's version is later than when the modifier was removed from Chapbook", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "var1: 17\n--\n" + "[mod]\nOther text\n";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Modifier [modMe] was removed in Chapbook version 2.1 and your StoryFormat version is 2.1"
                        );
                        expect(result.range).to.eql(Range.create(3, 1, 3, 4));
                    });

                    it("should error on spaces before modifiers", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "var1: 17\n--\n" + "  [note]\nOther text\n";
                        const callbacks = new MockCallbacks();
                        const state = buildParsingState({
                            content: header + passage,
                            callbacks: callbacks,
                        });
                        const parser = uut.getChapbookParser(undefined);

                        parser?.parsePassageText(passage, header.length, state);
                        const [result] = callbacks.errors;

                        expect(callbacks.errors.length).to.equal(1);
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Modifiers can't have spaces after them"
                        );
                        expect(result.range).to.eql(Range.create(3, 7, 3, 9));
                    });

                    it("should not error on blank lines before or after modifiers", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "var1: 17\n--\n" + "\n[note]\nOther text\n";
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
                            "var1: 17\r\n--\r\n" +
                            "\r\n[note]\r\nOther text\r\n";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Insert {fn insert} isn't available until Chapbook version 2.1.1 but your StoryFormat version is 2.1"
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Insert {fn insert} was removed in Chapbook version 2.1 and your StoryFormat version is 2.1"
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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
                        const passage =
                            "Insert: {mock insert, prop 1 a: 'arg'}";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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
                            firstArgRequired:
                                insertsModule.ArgumentRequirement.required,
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            'Insert "Mock Insert" requires a first argument'
                        );
                        expect(result.range).to.eql(Range.create(1, 10, 1, 21));
                    });

                    it("should warn about an ignored first argument", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: { mock insert: 'arg' }";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertInfo({
                            match: /^mock insert/,
                            firstArgRequired:
                                insertsModule.ArgumentRequirement.ignored,
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            'Insert "Mock Insert" will ignore this first argument'
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            'Insert "Mock Insert" missing expected properties: expected, also'
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            'Insert "Mock Insert" will ignore this property'
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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

                    it("should warn on engine extensions whose version is less than the story format's version", () => {
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
                            formatVersion: "2.0.1",
                        };
                        const parser = uut.getChapbookParser(undefined);

                        parser?.parsePassageText(passage, header.length, state);
                        const [result] = callbacks.errors;

                        expect(callbacks.errors.length).to.equal(1);
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            "The current story format version is 2.0.1, so this extension will be ignored"
                        );
                        expect(result.range).to.eql(Range.create(2, 15, 2, 20));
                    });

                    it("should not warn on engine extensions whose version is greater than the story format's version", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "[javascript]\nengine.extend('2.2.1', true);\n";
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

                    it("should warn on engine extensions whose version is shorter than the story format's version", () => {
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

                        expect(callbacks.errors.length).to.equal(1);
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            "The current story format version is 2.0.1, so this extension will be ignored"
                        );
                        expect(result.range).to.eql(Range.create(2, 15, 2, 18));
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            "Unrecognized engine template function"
                        );
                        expect(result.range).to.eql(Range.create(3, 0, 3, 20));
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
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

                    it("should error on a custom insert whose match object has incorrect regex flags", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi there/q}\n);\n});\n";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Regular expression flags can only be d, g, i, m, s, u, v, and y"
                        );
                        expect(result.range).to.eql(Range.create(4, 18, 4, 19));
                    });

                    it("should error on a custom insert whose match object has a borked regex", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi \\-/u}\n);\n});\n";
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
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Error
                        );
                        expect(result.message).to.include(
                            "Invalid regular expression"
                        );
                        expect(result.range).to.eql(Range.create(4, 8, 4, 16));
                    });
                });
            });
        });
    });

    describe("Completions", () => {
        describe("Variables", () => {
            it("should suggest variables in the vars section", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nv\n--\nContent"
                );
                const position = Position.create(1, 1);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 4, 0),
                    }),
                ]);
                index.setReferences("fake-uri", [
                    {
                        contents: "var1",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.Variable,
                    },
                    {
                        contents: "anotherVar",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(5, 6, 7, 8)
                            ),
                        ],
                        kind: OChapbookSymbolKind.Variable,
                    },
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.items[0]?.label).to.eql("var1");
                expect(results?.items[1]?.label).to.eql("anotherVar");
            });
        });

        describe("Modifiers", () => {
            it("should suggest modifiers after a [ at the start of the line", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ here "
                );
                const position = Position.create(1, 4);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 1, 1, 7)
                );
            });

            it("should suggest custom modifiers after a [ at the start of the line", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ here "
                );
                const position = Position.create(1, 4);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                index.setDefinitions("source-uri", [
                    {
                        contents: "custom modifier",
                        location: Location.create(
                            "source-uri",
                            Range.create(5, 6, 7, 8)
                        ),
                        kind: OChapbookSymbolKind.CustomModifier,
                        match: /custom\s+modifier/i,
                    } as ChapbookSymbol,
                ]);
                const parser = uut.getChapbookParser(undefined);
                const mockFunction = ImportMock.mockFunction(
                    modifiersModule,
                    "all"
                ).returns([]);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0]?.label).to.eql("custom modifier");
            });

            it("should suggest modifiers within [ ...;", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ here; not here "
                );
                const position = Position.create(1, 4);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 1, 1, 6)
                );
            });

            it("should suggest modifiers within [...; here", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ not here; here \nnot here"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 17)
                );
            });

            it("should suggest modifiers within [...]", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ here ] not here"
                );
                const position = Position.create(1, 4);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 1, 1, 7)
                );
            });

            it("should suggest modifiers within [...; here]", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\n[ not here; here] not here"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 16)
                );
            });
        });

        describe("Inserts", () => {
            it("should suggest insert names after a {", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("test insert");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should suggest custom insert names after a {", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                index.setDefinitions("source-uri", [
                    {
                        contents: "custom insert",
                        location: Location.create(
                            "source-uri",
                            Range.create(5, 6, 7, 8)
                        ),
                        kind: OChapbookSymbolKind.CustomInsert,
                        match: /custom\s+insert/i,
                    } as ChapbookSymbol,
                ]);
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0]?.label).to.eql("custom insert");
            });

            it("should suggest variables after a { with no other contents in the insert", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {va"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                index.setReferences("fake-uri", [
                    {
                        contents: "var1",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.Variable,
                    },
                ]);
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("var1");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should not suggest variables after a { if there are other contents in the insert", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {va nope"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                index.setReferences("fake-uri", [
                    {
                        contents: "var1",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.Variable,
                    },
                ]);
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items).to.be.empty;
            });

            it("should suggest insert names after a { and only replace the word the position is in", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te nope"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("test insert");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should suggest insert names after a { and before a ,", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te, prop: 'yep'"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("test insert");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should suggest insert names after a { and before a :", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te: 'first arg'"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("test insert");
                expect(results?.items[0].textEditText).to.eql("test insert");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should add a colon for an insert with a required first argument after a { with no colon of its own", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql(
                    "test insert: '${1:arg}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should add a colon for an insert with a required first argument after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te ,"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql(
                    "test insert: '${1:arg}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 14)
                );
            });

            it("should include an insert's required first argument's placeholder after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te ,"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql(
                    "test insert: '${1:URL}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 14)
                );
            });

            it("should include an insert's required first argument and properties' placeholders after a {", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te "
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {
                            one: "true",
                            two: "'falsy'",
                        },
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql(
                    "test insert: '${1:URL}', one: ${2:true}, two: '${3:falsy}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 13)
                );
            });

            it("should include an insert's required first argument's placeholder but no required properties' placeholders after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te ,"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {
                            one: "true",
                            two: "'falsy'",
                        },
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql(
                    "test insert: '${1:URL}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 14)
                );
            });

            it("should not add a colon after a { with a colon already there for an insert with a required first argument", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {te :"
                );
                const position = Position.create(1, 12);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.required,
                            placeholder: "'URL'",
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].textEditText).to.eql("test insert");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 11, 1, 14)
                );
            });

            it("should suggest passages after a { and a , and a : for first arguments that take a passage", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert: }"
                );
                const position = Position.create(1, 24);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "I'm a passage!",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                            type: insertsModule.ValueType.passage,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("I'm a passage!");
                expect(results?.items[0].textEditText).to.eql(
                    "'I'm a passage!'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 24, 1, 24)
                );
            });

            it("should suggest passages after a { and a , and a : for first arguments that take a urlOrPassage", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert: }"
                );
                const position = Position.create(1, 24);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                            type: insertsModule.ValueType.urlOrPassage,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("passage");
                expect(results?.items[0].textEditText).to.eql("'passage'");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 24, 1, 24)
                );
            });

            it("should suggest first argument passages inside existing quote marks", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: I'm a passage!\nLet's try {test insert: 'placeholder' }"
                );
                const position = Position.create(1, 27);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "I'm a passage!",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                            type: insertsModule.ValueType.passage,
                        },
                        requiredProps: {},
                        optionalProps: {},
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("I'm a passage!");
                expect(results?.items[0].textEditText).to.eql("I'm a passage!");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 25, 1, 36)
                );
            });

            it("should suggest insert properties after a { and a ,", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert, "
                );
                const position = Position.create(1, 23);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: { one: null },
                        optionalProps: { two: { placeholder: "'value'" } },
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("one");
                expect(results?.items[0].textEditText).to.eql(
                    " one: '${1:arg}'"
                );
                expect(results?.items[1].label).to.eql("two");
                expect(results?.items[1].textEditText).to.eql(
                    " two: '${1:value}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 23, 1, 23)
                );
            });

            it("should suggest insert properties after a { and a , changing only the property at the completion position", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert, :"
                );
                const position = Position.create(1, 23);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: { one: null },
                        optionalProps: { two: null },
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("one");
                expect(results?.items[0].textEditText).to.eql(
                    " one: '${1:arg}'"
                );
                expect(results?.items[1].label).to.eql("two");
                expect(results?.items[1].textEditText).to.eql(
                    " two: '${1:arg}'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 23, 1, 25)
                );
            });

            it("should not suggest insert property values after a { and a , and a : for general properties", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert, : 'here'"
                );
                const position = Position.create(1, 28);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "passage",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: { one: null },
                        optionalProps: { two: null },
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results).to.be.null;
            });

            it("should suggest passages for insert property values that take a passage after a { and a , and a :", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    ":: Passage\nLet's try {test insert, one: 'here',"
                );
                const position = Position.create(1, 30);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({
                        label: "I'm a passage!",
                        scope: Range.create(0, 0, 2, 0),
                    }),
                ]);
                const insert: insertsModule.InsertInfo = {
                    name: "test insert",
                    syntax: "test insert",
                    description: "desc",
                    match: /^test\s+insert/i,
                    completions: ["test insert"],
                    arguments: {
                        firstArgument: {
                            required:
                                insertsModule.ArgumentRequirement.optional,
                        },
                        requiredProps: {
                            one: {
                                placeholder: "arg",
                                type: insertsModule.ValueType.passage,
                            },
                        },
                        optionalProps: { two: null },
                    },
                    parse: () => {},
                };
                const mockFunction = ImportMock.mockFunction(
                    insertsModule,
                    "all"
                ).returns([insert]);
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );
                mockFunction.restore();

                expect(results?.items[0].label).to.eql("I'm a passage!");
                expect(results?.items[0].textEditText).to.eql("I'm a passage!");
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(1, 30, 1, 34)
                );
            });
        });
    });

    describe("Diagnostics", () => {
        describe("inserts and modifiers", () => {
            it("should warn on an unrecognized insert", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert, one: 'here',"
                );
                const index = new Index();
                index.setReferences("fake-uri", [
                    {
                        contents: "custom insert",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomInsert,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = true;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.eql([
                    Diagnostic.create(
                        Range.create(1, 2, 3, 4),
                        'Insert "custom insert" not recognized',
                        DiagnosticSeverity.Warning
                    ),
                ]);
            });

            it("should not warn on an unrecognized insert if that warning is disabled", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert, one: 'here',"
                );
                const index = new Index();
                index.setReferences("fake-uri", [
                    {
                        contents: "custom insert",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomInsert,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = false;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.be.empty;
            });

            it("should not warn on an insert that matches a custom insert definition", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {custom insert, one: 'here',"
                );
                const index = new Index();
                index.setDefinitions("source-uri", [
                    {
                        contents: "custom\\s+insert",
                        location: Location.create(
                            "source-uri",
                            Range.create(5, 6, 7, 8)
                        ),
                        kind: OChapbookSymbolKind.CustomInsert,
                        match: /custom\s+insert/,
                    } as ChapbookSymbol,
                ]);
                index.setReferences("fake-uri", [
                    {
                        contents: "custom insert",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomInsert,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = true;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.be.empty;
            });

            it("should warn on an unrecognized modifier", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[mod-me]\nI'm modified!"
                );
                const index = new Index();
                index.setReferences("fake-uri", [
                    {
                        contents: "mod-me",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomModifier,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = true;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.eql([
                    Diagnostic.create(
                        Range.create(1, 2, 3, 4),
                        'Modifier "mod-me" not recognized',
                        DiagnosticSeverity.Warning
                    ),
                ]);
            });

            it("should not warn on an unrecognized modifier if that warning is disabled", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[mod-me]\nI'm modified!"
                );
                const index = new Index();
                index.setReferences("fake-uri", [
                    {
                        contents: "mod-me",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomModifier,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = false;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.be.empty;
            });

            it("should not warn on a modifier that matches a custom modifier definition", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[mod-me additional parameters]\nI'm modified!"
                );
                const index = new Index();
                index.setDefinitions("source-uri", [
                    {
                        contents: "mod-me",
                        location: Location.create(
                            "source-uri",
                            Range.create(5, 6, 7, 8)
                        ),
                        kind: OChapbookSymbolKind.CustomModifier,
                        match: /mod-me/,
                    } as ChapbookSymbol,
                ]);
                index.setReferences("fake-uri", [
                    {
                        contents: "mod-me",
                        locations: [
                            Location.create(
                                "fake-uri",
                                Range.create(1, 2, 3, 4)
                            ),
                        ],
                        kind: OChapbookSymbolKind.CustomModifier,
                    },
                ]);
                const diagnosticOptions = defaultDiagnosticsOptions;
                diagnosticOptions.warnings.unknownMacro = true;
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateDiagnostics(
                    doc,
                    index,
                    diagnosticOptions
                );

                expect(results).to.be.empty;
            });
        });
    });

    describe("Definitions", () => {
        it("should return undefined from a position not inside an insert or modifier", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert, one: 'here',"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom    insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const result = parser?.getDefinitionAt(
                doc,
                Position.create(9, 4),
                index
            );

            expect(result).to.be.undefined;
        });

        it("should return a custom insert's definition from a position in a use of that insert", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "Let's try {custom insert, one: 'here',"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom    insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const result = parser?.getDefinitionAt(
                doc,
                Position.create(1, 4),
                index
            );

            expect(result).to.eql(
                Location.create("source-uri", Range.create(5, 6, 7, 8))
            );
        });

        it("should return a custom modifier's definition from a position in a use of that modifier", () => {
            const doc = TextDocument.create(
                "fake-uri",
                "",
                0,
                "[mod-me additional parameters]\nI'm modified!"
            );
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "mod-me",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /mod\s+me/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "mod   me",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const diagnosticOptions = defaultDiagnosticsOptions;
            diagnosticOptions.warnings.unknownMacro = true;
            const parser = uut.getChapbookParser(undefined);

            const result = parser?.getDefinitionAt(
                doc,
                Position.create(1, 4),
                index
            );

            expect(result).to.eql(
                Location.create("source-uri", Range.create(5, 6, 7, 8))
            );
        });
    });

    describe("Hover", () => {
        it("should return a built-in modifier's definition for a position inside a reference to that modifier", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mock-mod",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.BuiltInModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const modifier = buildModifierInfo({
                description: "My description!",
                match: /^mock-mod/,
            });
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "My description!",
                },
            });
        });

        it("should return a built-in modifier's definition along with its syntax for a position inside a reference to that modifier", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mock-mod",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.BuiltInModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const modifier = buildModifierInfo({
                description: "My description!",
                match: /^mock-mod/,
            });
            modifier.syntax = "My syntax";
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([modifier]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "```chapbook\nMy syntax\n```\n\nMy description!",
                },
            });
        });

        it("should return a custom modifier's description for a position inside a reference to that modifier if that description is defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom modifier",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    description: "This is a custom modifier!",
                    match: /custom\s+modifier/i,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom  modifier",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "This is a custom modifier!",
                },
            });
        });

        it("should return a custom modifier's description and syntax for a position inside a reference to that modifier if its description and syntax are defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom modifier",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    syntax: "[custom modifier]",
                    description: "This is a custom modifier!",
                    match: /custom\s+modifier/i,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom  modifier",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "```chapbook\n[custom modifier]\n```\n\nThis is a custom modifier!",
                },
            });
        });

        it("should return null for a position inside a reference to a custom modifier if that modifier's description isn't defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom modifier",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomModifier,
                    match: /custom\s+modifier/i,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom  modifier",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomModifier,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                modifiersModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.be.null;
        });

        it("should return a built-in insert's description for a position inside a reference to that insert", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mock insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.BuiltInInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const insert = buildInsertInfo({
                description: "My description!",
                match: /^mock insert/,
            });
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "My description!",
                },
            });
        });

        it("should return a built-in insert's description and syntax for a position inside a reference to that insert", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setReferences("fake-uri", [
                {
                    contents: "mock insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.BuiltInInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const insert = buildInsertInfo({
                description: "My description!",
                match: /^mock insert/,
            });
            insert.syntax = "{mock insert}";
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([insert]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "```chapbook\n{mock insert}\n```\n\nMy description!",
                },
            });
        });

        it("should return a custom insert's description for a position inside a reference to that insert if its description is defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    description: "This is a custom insert!",
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "This is a custom insert!",
                },
            });
        });

        it("should return a custom insert's description and syntax for a position inside a reference to that insert if its description and syntax are defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    description: "This is a custom insert!",
                    syntax: "{custom insert}",
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "custom insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.eql({
                contents: {
                    kind: MarkupKind.Markdown,
                    value: "```chapbook\n{custom insert}\n```\n\nThis is a custom insert!",
                },
            });
        });

        it("should return null for a position inside a reference to a custom insert whose description isn't defined", () => {
            const doc = TextDocument.create("fake-uri", "", 0, "Placeholder");
            const index = new Index();
            index.setDefinitions("source-uri", [
                {
                    contents: "custom\\s+insert",
                    location: Location.create(
                        "source-uri",
                        Range.create(5, 6, 7, 8)
                    ),
                    kind: OChapbookSymbolKind.CustomInsert,
                    description: "This is a custom insert!",
                    match: /custom\s+insert/,
                } as ChapbookSymbol,
            ]);
            index.setReferences("fake-uri", [
                {
                    contents: "mock insert",
                    locations: [
                        Location.create("fake-uri", Range.create(1, 2, 3, 4)),
                    ],
                    kind: OChapbookSymbolKind.CustomInsert,
                },
            ]);
            const parser = uut.getChapbookParser(undefined);
            const mockFunction = ImportMock.mockFunction(
                insertsModule,
                "all"
            ).returns([]);

            const result = parser?.generateHover(
                doc,
                Position.create(1, 3),
                index
            );
            mockFunction.restore();

            expect(result).to.be.null;
        });
    });
});
