import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import {
    Diagnostic,
    DiagnosticSeverity,
    Location,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import { buildInsertParser } from "./inserts/insert-builders";
import { Index, TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../tokens";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as uut from "../../../passage-text-parsers/chapbook";
import {
    ChapbookSymbol,
    ChapbookSymbolKind,
} from "../../../passage-text-parsers/chapbook/chapbook-parser";
import { defaultDiagnosticsOptions } from "../../../server-options";

describe("Chapbook Passage", () => {
    describe("Parsing", () => {
        describe("vars section", () => {
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
            describe("modifiers", () => {
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
                    const [result] = callbacks.embeddedDocuments;

                    expect(result.document.getText()).to.eql(
                        "Fake CSS\nMore fake\n"
                    );
                    expect(result.document.languageId).to.eql("css");
                    expect(result.offset).to.eql(38);
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
                    it("should send the first arg to the matching insert", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  'arg'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                        const insert = buildInsertParser({
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
                        const result = callbacks.references;

                        expect(result).to.eql([
                            {
                                contents: "arg",
                                location: Location.create(
                                    "fake-uri",
                                    Range.create(1, 24, 1, 27)
                                ),
                                kind: TwineSymbolKind.Passage,
                            },
                        ]);
                    });

                    it("should create a passage semantic token for a first arg that's a passage", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  'arg'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                        const insert = buildInsertParser({
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
                        const result = callbacks.references;

                        expect(result).to.eql([
                            {
                                contents: "arg",
                                location: Location.create(
                                    "fake-uri",
                                    Range.create(1, 24, 1, 27)
                                ),
                                kind: TwineSymbolKind.Passage,
                            },
                        ]);
                    });

                    it("should create a passage semantic token for a non-link first arg that's a urlOrPassage", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  'arg'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                        const insert = buildInsertParser({
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

                        expect(result).to.be.empty;
                    });
                    it("should create a string semantic token for a link first arg that's a urlOrPassage", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "Insert: {mock insert:  'https://link.com'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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

                    it("should create a variable semantic token for a non-string first arg that's a urlOrPassage", () => {
                        const header = ":: Passage\n";
                        const passage = "Insert: {mock insert:  arg}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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

                    it("should create a passage semantic token for a property that's a passage", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "Insert: {mock insert:  'arg', prop1: 'yes', prop2: 'no'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                            "Insert: {mock insert ,  prop1: 'yes', prop2: 'no'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                                { text: "'yes'", at: 42 },
                            ],
                            prop2: [
                                { text: "prop2", at: 49 },
                                { text: "'no'", at: 56 },
                            ],
                        });
                    });

                    it("should send all contents to the matching insert", () => {
                        const header = ":: Passage\n";
                        const passage =
                            "Insert: {mock insert: 'arg', prop1: 'yes', prop2: 'no'}";
                        const callbacks = new MockCallbacks();
                        const insert = buildInsertParser({
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
                    const result = callbacks.definitions[0] as ChapbookSymbol;

                    expect(callbacks.definitions.length).to.equal(1);
                    expect(ChapbookSymbol.is(result)).to.be.true;
                    expect(result).to.eql({
                        contents: "hi",
                        location: Location.create(
                            "fake-uri",
                            Range.create(4, 9, 4, 11)
                        ),
                        kind: ChapbookSymbolKind.Insert,
                        match: /hi/,
                    });
                });

                it("should capture a symbol definition for a custom modifier", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "[javascript]\nengine.extend('2.0.1', () => {\nengine.template.modifiers.add(\n{match: /hi/}\n);\n});\n";
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
                        contents: "hi",
                        location: Location.create(
                            "fake-uri",
                            Range.create(4, 9, 4, 11)
                        ),
                        kind: ChapbookSymbolKind.Modifier,
                        match: /hi/,
                    });
                });
            });
        });
    });

    describe("Completions", () => {
        describe("Modifiers", () => {
            it("should suggest modifiers after a [ at the start of the line", () => {
                const doc = TextDocument.create("fake-uri", "", 0, "[ here ");
                const position = Position.create(0, 4);
                const index = new Index();
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 1, 0, 7)
                );
            });

            it("should suggest modifiers within [ ...;", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[ here; not here "
                );
                const position = Position.create(0, 4);
                const index = new Index();
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 1, 0, 6)
                );
            });

            it("should suggest modifiers within [...; here", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[ not here; here \nnot here"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 11, 0, 17)
                );
            });

            it("should suggest modifiers within [...]", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[ here ] not here"
                );
                const position = Position.create(0, 4);
                const index = new Index();
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 1, 0, 7)
                );
            });

            it("should suggest modifiers within [...; here]", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "[ not here; here] not here"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const parser = uut.getChapbookParser(undefined);

                const results = parser?.generateCompletions(
                    doc,
                    position,
                    index
                );

                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 11, 0, 16)
                );
            });
        });

        describe("Inserts", () => {
            it("should suggest insert names after a {", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should suggest insert names after a { and only replace the word the position is in", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te nope"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should suggest insert names after a { and before a ,", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te, prop: 'yep'"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should suggest insert names after a { and before a :", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te: 'first arg'"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should add a colon for an insert with a required first argument after a { with no colon of its own", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should add a colon for an insert with a required first argument after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te ,"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 14)
                );
            });

            it("should include an insert's required first argument's placeholder after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te ,"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 14)
                );
            });

            it("should include an insert's required first argument and properties' placeholders after a {", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te "
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 13)
                );
            });

            it("should include an insert's required first argument's placeholder but no required properties' placeholders after a { with a comma", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te ,"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 14)
                );
            });

            it("should not add a colon after a { with a colon already there for an insert with a required first argument", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {te :"
                );
                const position = Position.create(0, 12);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 11, 0, 14)
                );
            });

            it("should suggest passages after a { and a , and a : for first arguments that take a passage", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert: }"
                );
                const position = Position.create(0, 24);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({ label: "I'm a passage!" }),
                ]);
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 24, 0, 24)
                );
            });

            it("should suggest passages after a { and a , and a : for first arguments that take a urlOrPassage", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert: }"
                );
                const position = Position.create(0, 24);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({ label: "I'm a passage!" }),
                ]);
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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

                expect(results?.items[0].label).to.eql("I'm a passage!");
                expect(results?.items[0].textEditText).to.eql(
                    "'I'm a passage!'"
                );
                expect(results?.itemDefaults?.editRange).to.eql(
                    Range.create(0, 24, 0, 24)
                );
            });

            it("should suggest first argument passages inside existing quote marks", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert: 'placeholder' }"
                );
                const position = Position.create(0, 27);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({ label: "I'm a passage!" }),
                ]);
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 25, 0, 36)
                );
            });

            it("should suggest insert properties after a { and a ,", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert, "
                );
                const position = Position.create(0, 23);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 23, 0, 23)
                );
            });

            it("should suggest insert properties after a { and a , changing only the property at the completion position", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert, :"
                );
                const position = Position.create(0, 23);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 23, 0, 25)
                );
            });

            it("should not suggest insert property values after a { and a , and a : for general properties", () => {
                const doc = TextDocument.create(
                    "fake-uri",
                    "",
                    0,
                    "Let's try {test insert, : 'here'"
                );
                const position = Position.create(0, 28);
                const index = new Index();
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    "Let's try {test insert, one: 'here',"
                );
                const position = Position.create(0, 30);
                const index = new Index();
                index.setPassages("fake-uri", [
                    buildPassage({ label: "I'm a passage!" }),
                ]);
                const insert: insertsModule.InsertParser = {
                    name: "test insert",
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
                    Range.create(0, 30, 0, 34)
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
                        kind: ChapbookSymbolKind.Insert,
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
                        "Insert custom insert not recognized",
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
                        kind: ChapbookSymbolKind.Insert,
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
                    "Let's try {test insert, one: 'here',"
                );
                const index = new Index();
                index.setDefinitions("source-uri", [
                    {
                        contents: "custom\\s+insert",
                        location: Location.create(
                            "source-uri",
                            Range.create(5, 6, 7, 8)
                        ),
                        kind: ChapbookSymbolKind.Insert,
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
                        kind: ChapbookSymbolKind.Insert,
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
                        kind: ChapbookSymbolKind.Modifier,
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
                        "Modifier mod-me not recognized",
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
                        kind: ChapbookSymbolKind.Modifier,
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
                        kind: ChapbookSymbolKind.Modifier,
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
                        kind: ChapbookSymbolKind.Modifier,
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

                it("should flag a property with a space", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert, prop 1 a: 'arg'}";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertParser({
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
                    const insert = buildInsertParser({
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        'Insert "Mock Insert" requires a first argument'
                    );
                    expect(result.range).to.eql(Range.create(1, 10, 1, 21));
                });

                it("should warn about an ignored first argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert: 'arg' }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertParser({
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        'Insert "Mock Insert" will ignore this first argument'
                    );
                    expect(result.range).to.eql(Range.create(1, 23, 1, 28));
                });

                it("should flag a missing required property", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertParser({
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
                        'Insert "Mock Insert" missing expected properties: expected, also'
                    );
                    expect(result.range).to.eql(Range.create(1, 10, 1, 21));
                });

                it("should not flag missing optional properties", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: { mock insert }";
                    const callbacks = new MockCallbacks();
                    const insert = buildInsertParser({
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
                    const insert = buildInsertParser({
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
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
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Invalid regular expression"
                    );
                    expect(result.range).to.eql(Range.create(4, 8, 4, 16));
                });
            });
        });
    });
});
