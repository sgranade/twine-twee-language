import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { DiagnosticSeverity, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { MockCallbacks, buildParsingState } from "../../builders";
import { buildInsertParser } from "./inserts/insert-builders";
import { ETokenModifier, ETokenType } from "../../../tokens";
import * as insertsModule from "../../../passage-text-parsers/chapbook/inserts";
import * as modifiersModule from "../../../passage-text-parsers/chapbook/modifiers";
import { Index } from "../../../project-index";
import * as uut from "../../../passage-text-parsers/chapbook";

describe("Chapbook Passage", () => {
    describe("Parsing", () => {
        describe("vars section", () => {
            it("should set a semantic token for a var", () => {
                const header = ":: Passage\n";
                const passage = " var1: 17\n--\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getChapbookParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.tokens;

                expect(result).to.eql({
                    line: 1,
                    char: 1,
                    length: 4,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [ETokenModifier.modification],
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
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.passageReferences;

                    expect(result).to.eql({
                        "target passage": [Range.create(2, 15, 2, 29)],
                    });
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
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.passageReferences;

                    expect(result).to.eql({
                        "target passage": [Range.create(2, 35, 2, 49)],
                    });
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
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.passageReferences;

                    expect(result).to.eql({
                        "target passage": [Range.create(2, 36, 2, 50)],
                    });
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
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.passageReferences;

                    expect(result).to.eql({
                        "target passage": [Range.create(2, 15, 2, 29)],
                    });
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
                            "A function insert: { back soon: arg  }.\n";
                        const callbacks = new MockCallbacks();
                        const state = buildParsingState({
                            content: header + passage,
                            callbacks: callbacks,
                        });
                        const parser = uut.getChapbookParser(undefined);

                        parser?.parsePassageText(passage, header.length, state);
                        const [result] = callbacks.tokens;

                        expect(callbacks.tokens.length).to.equal(1);
                        expect(result).to.eql({
                            line: 2,
                            char: 21,
                            length: 9,
                            tokenType: ETokenType.function,
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
                            "A function insert: { back soon,  prop1: val1, prop2 : val2  }.\n";
                        const callbacks = new MockCallbacks();
                        const state = buildParsingState({
                            content: header + passage,
                            callbacks: callbacks,
                        });
                        const parser = uut.getChapbookParser(undefined);

                        parser?.parsePassageText(passage, header.length, state);
                        const [functionToken, prop1Token, prop2Token] =
                            callbacks.tokens;

                        expect(callbacks.tokens.length).to.equal(3);
                        expect(functionToken).to.eql({
                            line: 2,
                            char: 21,
                            length: 9,
                            tokenType: ETokenType.function,
                            tokenModifiers: [],
                        });
                        expect(prop1Token).to.eql({
                            line: 2,
                            char: 33,
                            length: 5,
                            tokenType: ETokenType.property,
                            tokenModifiers: [],
                        });
                        expect(prop2Token).to.eql({
                            line: 2,
                            char: 46,
                            length: 5,
                            tokenType: ETokenType.property,
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
                        const [functionToken, prop1Token, prop2Token] =
                            callbacks.tokens;

                        expect(callbacks.tokens.length).to.equal(3);
                        expect(functionToken).to.eql({
                            line: 2,
                            char: 21,
                            length: 9,
                            tokenType: ETokenType.function,
                            tokenModifiers: [],
                        });
                        expect(prop1Token).to.eql({
                            line: 2,
                            char: 38,
                            length: 5,
                            tokenType: ETokenType.property,
                            tokenModifiers: [],
                        });
                        expect(prop2Token).to.eql({
                            line: 2,
                            char: 51,
                            length: 5,
                            tokenType: ETokenType.property,
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
        });
    });

    describe("Completions", () => {
        describe("modifiers", () => {
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
    });

    describe("errors", () => {
        describe("vars section", () => {
            it("should warn on a missing colon", () => {
                const header = ":: Passage\n";
                const passage = "var1 = wrong\n--\n";
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
                expect(result.range).to.eql(Range.create(1, 0, 1, 12));
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

                it("should warn on an unrecognized modifier", () => {
                    const header = ":: Passage\n";
                    const passage = "[okay; modifier]\nOther text";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const modifier: modifiersModule.ModifierParser = {
                        name: "okay",
                        match: /^okay/i,
                        completions: ["okay"],
                        parse: () => {},
                    };
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        'Modifier "modifier" not recognized'
                    );
                    expect(result.range).to.eql(Range.create(1, 7, 1, 15));
                });

                it("should not warn on a modifier because of its additional parameters", () => {
                    const header = ":: Passage\n";
                    const passage = "[okay and also this; okay]\nOther text";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getChapbookParser(undefined);
                    const modifier: modifiersModule.ModifierParser = {
                        name: "okay",
                        match: /^okay/i,
                        completions: ["okay"],
                        parse: () => {},
                    };
                    const mockFunction = ImportMock.mockFunction(
                        modifiersModule,
                        "all"
                    ).returns([modifier]);

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();

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

                    expect(callbacks.errors.length).to.equal(2); // Second error is b/c "fn insert" doesn't exist
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Properties can't have spaces"
                    );
                    expect(result.range).to.eql(Range.create(1, 13, 1, 21));
                });

                it("should warn on an unrecognized insert", () => {
                    const header = ":: Passage\n";
                    const passage = "Insert: {mock insert: 'arg'}";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
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
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        'Insert "mock insert" not recognized'
                    );
                    expect(result.range).to.eql(Range.create(1, 9, 1, 20));
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
        });
    });
});
