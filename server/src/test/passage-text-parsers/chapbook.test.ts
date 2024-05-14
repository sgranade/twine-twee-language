import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Range } from "vscode-languageserver";

import { ETokenModifier, ETokenType } from "../../tokens";
import { MockCallbacks, buildParsingState } from "../builders";
import * as uut from "../../passage-text-parsers/chapbook";

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
            it("should error on spaces before modifiers", () => {
                const header = ":: Passage\n";
                const passage = "var1: 17\n--\n" + "  [modifier]\nOther text\n";
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
                    "var1: 17\n--\n" + " [modifier]  \nOther text\n";
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
                expect(result.range).to.eql(Range.create(3, 11, 3, 13));
            });

            it("should not error on blank lines before or after modifiers", () => {
                const header = ":: Passage\n";
                const passage = "var1: 17\n--\n" + "\n[modifier]\nOther text\n";
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
                    "var1: 17\r\n--\r\n" + "\r\n[modifier]\r\nOther text\r\n";
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
    });
});
