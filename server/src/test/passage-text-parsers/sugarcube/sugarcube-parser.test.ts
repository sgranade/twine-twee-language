import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../semantic-tokens";
import { MacroLocationInfo } from "../../../passage-text-parsers/sugarcube/sugarcube-parser";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import {
    buildMacroInfo,
    buildMacroInfoWithArgs,
} from "./macros/macro-builders";

import * as macrosModule from "../../../passage-text-parsers/sugarcube/macros";
import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Parser", () => {
    describe("special passages", () => {
        it("should create an embedded css document for a stylesheet-tagged passage", () => {
            const header = ":: Passage [stylesheet]\n";
            const passage = "Contents!\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
            });
            state.currentPassage.tags = [
                {
                    contents: "stylesheet",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 22)
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.embeddedDocuments[0];

            expect(callbacks.embeddedDocuments.length).to.equal(1);
            expect(result.document.getText()).to.eql("Contents!\n");
            expect(result.document.languageId).to.eql("css");
            expect(result.range).to.eql(Range.create(1, 0, 2, 0));
            expect(result.isPassage).to.be.false;
        });

        it("should not create an embedded html document on a Twine.audio tagged passage", () => {
            const header = ":: Passage [Twine.audio]\n";
            const passage = "Stuff\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
            });
            state.currentPassage.tags = [
                {
                    contents: "Twine.audio",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 23)
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);

            expect(callbacks.embeddedDocuments).to.be.empty;
        });

        it("should not create an embedded html document on a Twine.image tagged passage", () => {
            const header = ":: Passage [Twine.image]\n";
            const passage = "Stuff\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
            });
            state.currentPassage.tags = [
                {
                    contents: "Twine.image",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 23)
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);

            expect(callbacks.embeddedDocuments).to.be.empty;
        });

        it("should not create an embedded html document on a Twine.video tagged passage", () => {
            const header = ":: Passage [Twine.video]\n";
            const passage = "Stuff\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
            });
            state.currentPassage.tags = [
                {
                    contents: "Twine.video",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 23)
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);

            expect(callbacks.embeddedDocuments).to.be.empty;
        });

        it("should not create an embedded html document on a Twine.vtt tagged passage", () => {
            const header = ":: Passage [Twine.vtt]\n";
            const passage = "Stuff\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
            });
            state.currentPassage.tags = [
                {
                    contents: "Twine.vtt",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 23)
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);

            expect(callbacks.embeddedDocuments).to.be.empty;
        });
    });

    describe("variables", () => {
        it("should capture a variable reference for a bare variable", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "This is a $bare_variable.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$bare_variable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 10, 2, 24)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a variable reference for a bare variable and its property", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is a $bareVariable.prop.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(callbacks.references.length).to.equal(2);
            expect(result).to.eql([
                {
                    contents: "$bareVariable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 10, 2, 23)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "$bareVariable.prop",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 24, 2, 28)
                    ),
                    kind: OSugarCubeSymbolKind.Property,
                },
            ]);
        });

        it("should capture a variable reference for a bare variable and a variable used in bracket property access", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is a $bareVariable[_otherVar].\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(callbacks.references.length).to.equal(2);
            expect(result).to.eql([
                {
                    contents: "$bareVariable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 10, 2, 23)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "_otherVar",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 24, 2, 33)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a variable reference for text with underscores", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "This is no_variable.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a variable reference for a bare variable inside nowiki quote markup", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + 'This is not a """$bareVariable""".\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a variable reference for a bare variable inside nowiki tag markup", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                "This is not a <nowiki>$bareVariable</nowiki>.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a variable reference for a bare variable inside verbatim html markup", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                "This is not a <html>$bareVariable</html>.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a variable reference for a bare variable preceded by a double $ sigil", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is not a $$bareVariable.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a variable reference for a bare variable in inline {{{code markup}}}", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is not a {{{$bareVariable}}}.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should produce a semantic token for a bare variable", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "This is a $bareVariable.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 2,
                    char: 10,
                    length: 13,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should produce a semantic token for a bare variable and its property", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is a $bareVariable.prop.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(2);
            expect(result).to.eql([
                {
                    line: 2,
                    char: 10,
                    length: 13,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 24,
                    length: 4,
                    tokenType: ETokenType.property,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should produce a semantic token for a bare variable and a variable used in bracket property access", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is a $bareVariable[$otherVar].\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(2);
            expect(result).to.eql([
                {
                    line: 2,
                    char: 10,
                    length: 13,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 24,
                    length: 9,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should produce a semantic token for a bare variable and a string used in bracket property access", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + "This is a $bareVariable['string'].\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(2);
            expect(result).to.eql([
                {
                    line: 2,
                    char: 10,
                    length: 13,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 24,
                    length: 8,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should produce a semantic token for a bare variable and a number used in bracket property access", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "This is a $bareVariable[7].\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(2);
            expect(result).to.eql([
                {
                    line: 2,
                    char: 10,
                    length: 13,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 24,
                    length: 1,
                    tokenType: ETokenType.number,
                    tokenModifiers: [],
                },
            ]);
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
            const parser = uut.getSugarCubeParser(undefined);

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
            const parser = uut.getSugarCubeParser(undefined);

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

        it("should set semantic tokens for a [[target]] link with TwineScript", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                'Here it is: [[ "go to" + $tempy ]]\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 2,
                    char: 15,
                    length: 7,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 23,
                    length: 1,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 25,
                    length: 6,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
            ]);
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
            const parser = uut.getSugarCubeParser(undefined);

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

        it("should not capture a passage reference for a [[link]] with a function call", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ previous() ]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should capture variable references for a [[link]] with TwineScript", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                'Here it is: [[ "go to" + $tempy ]]\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 25, 2, 31)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
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
            const parser = uut.getSugarCubeParser(undefined);

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
            const parser = uut.getSugarCubeParser(undefined);

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

        it("should not capture a passage reference for a [[display|target]] link with a function call", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string | previous() ]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
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
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [displayToken, arrowToken, targetToken] = callbacks.tokens;

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
            const parser = uut.getSugarCubeParser(undefined);

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

        it("should not capture a passage reference for a [[display->target]] link with a function call", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string -> previous() ]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
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
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [targetToken, arrowToken, displayToken] = callbacks.tokens;

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
            const parser = uut.getSugarCubeParser(undefined);

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

        it("should not capture a passage reference for a [[target<-display]] link with a function", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ previous() <- display w a string ]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should set semantic tokens for a [[target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a setter link!\n" +
                "Here it is: [[ target passage ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const results = callbacks.tokens;

            expect(results).to.eql([
                {
                    line: 2,
                    char: 15,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 32,
                    length: 6,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 39,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 42,
                    length: 1,
                    tokenType: ETokenType.number,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should capture the passage reference for a [[target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ target passage ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

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
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 32, 2, 38)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a passage reference for a [[target][setter]] link with a function", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ previous() ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 28, 2, 34)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should set semantic tokens for a [[display|target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string | target passage][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 2,
                    char: 14,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 33,
                    length: 1,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 35,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 51,
                    length: 6,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 58,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 61,
                    length: 1,
                    tokenType: ETokenType.number,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should capture the passage reference for a [[display|target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string | target passage ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

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
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 52, 2, 58)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a passage reference for a [[display|target][setter]] link with a function", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string | previous() ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 48, 2, 54)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should set semantic tokens for a [[display->target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string -> target passage][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const results = callbacks.tokens;

            expect(results).to.eql([
                {
                    line: 2,
                    char: 14,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 33,
                    length: 2,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 36,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 52,
                    length: 6,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 59,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 62,
                    length: 1,
                    tokenType: ETokenType.number,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should capture the passage reference for a [[display->target][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string -> target passage ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

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
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 53, 2, 59)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a passage reference for a [[display->target][setter]] link with a function", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[display w a string -> previous() ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 49, 2, 55)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should set semantic tokens for a [[target<-display][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ target passage <- display w a string ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 2,
                    char: 15,
                    length: 14,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 30,
                    length: 2,
                    tokenType: ETokenType.keyword,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 33,
                    length: 18,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 54,
                    length: 6,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 61,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 64,
                    length: 1,
                    tokenType: ETokenType.number,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should capture the passage reference for a [[target<-display][setter]] link", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ target passage <- display w a string ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

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
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 54, 2, 60)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a passage reference for a [[target<-display][setter]] link with a function", () => {
            const header = ":: Passage\n";
            const passage =
                "We shall introduce: a link!\n" +
                "Here it is: [[ previous() <- display w a string ][$tempy to 7]]\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 50, 2, 56)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });
    });

    describe("macros", () => {
        it("should produce semantic tokens for a simple macro", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "A macro: <<testy>>.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const [functionToken] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(1);
            expect(functionToken).to.eql({
                line: 2,
                char: 11,
                length: 5,
                tokenType: ETokenType.function,
                tokenModifiers: [],
            });
        });

        it("should indicate deprecation in a simple macro's semantic token when applicable", () => {
            const header = ":: Passage\n";
            const passage = "Some content.\n" + "A macro: <<testy>>.\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.storyFormat = {
                format: "SugarCube",
                formatVersion: "2.1",
            };
            const parser = uut.getSugarCubeParser("2.1");
            const macro = buildMacroInfo({ name: "testy" });
            macro.deprecated = "2.1";
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const [functionToken] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(1);
            expect(functionToken).to.eql({
                line: 2,
                char: 11,
                length: 5,
                tokenType: ETokenType.function,
                tokenModifiers: [ETokenModifier.deprecated],
            });
        });

        it("should capture a reference for a known macro", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <<testy>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references[0];

            expect(callbacks.references.length).to.equal(1);
            expect(result).to.eql({
                contents: "testy",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 9, 1, 14)
                ),
                kind: OSugarCubeSymbolKind.KnownMacro,
            });
        });

        it("should not capture a macro reference inside a {{{no-wiki block}}}", () => {
            const header = ":: Passage\n";
            const passage = "Macro: {{{<<testy>>}}}";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it('should not capture a macro reference inside a """no-wiki block"""', () => {
            const header = ":: Passage\n";
            const passage = 'Macro: """<<testy>>"""';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a macro reference inside a <nowiki></nowiki> block", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <nowiki><<testy>></nowiki>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a macro reference inside an <html></html> block", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <html><<testy>></html>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a macro reference inside a <script></script> block", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <script><<testy>></script>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should not capture a macro reference inside a <style></style> block", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <style><<testy>></style>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should pass arguments to a macro's parse function if defined", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <<testy arg1 arg2>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            let macroArgs: string | undefined;
            let macroArgsIndex: number | undefined;
            macro.parse = (args, argsIndex) => {
                macroArgs = args;
                macroArgsIndex = argsIndex;
                return true;
            };
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();

            expect(macroArgs).to.eql("arg1 arg2");
            expect(macroArgsIndex).to.equal(26);
        });

        it("should pass children to a container macro's parseChildren function if defined", () => {
            const header = ":: Passage\n";
            const passage = "Macro: <<testy>><<kid>><<kid>><</testy>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const testyMacro = buildMacroInfo({
                name: "testy",
                container: true,
            });
            let macroKids: MacroLocationInfo[] | undefined;
            testyMacro.parseChildren = (kids) => {
                macroKids = kids;
            };
            const kidMacro = buildMacroInfo({ name: "kid" });
            kidMacro.parents = ["testy"];
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({
                testy: testyMacro,
                kid: kidMacro,
            });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();

            expect(macroKids).to.eql([
                { name: "kid", fullText: "<<kid>>", at: 27, id: 1 },
                { name: "kid", fullText: "<<kid>>", at: 34, id: 2 },
            ]);
        });

        describe("built-in macros", () => {
            // Added this test to make sure the <<script>> macro isn't mistaken for the <script> HTML tag
            it("should capture a reference for the script macro", () => {
                const header = ":: Passage\n";
                const passage = "Macro: <<script>><</script>>";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references[0];

                expect(callbacks.references.length).to.equal(1);
                expect(result).to.eql({
                    contents: "script",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 9, 1, 15)
                    ),
                    kind: OSugarCubeSymbolKind.KnownMacro,
                });
            });

            it("should create semantic tokens for the contents of a script macro as JavaScript", () => {
                const header = ":: Passage\n";
                const passage = "Macro: <<script>>const tempy = 1;<</script>>";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.tokens;

                // Slice to get rid of the tokens for the <<script>> macro
                expect(result.slice(1, -1)).to.eql([
                    {
                        line: 1,
                        char: 17,
                        length: 5,
                        tokenType: ETokenType.keyword,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 23,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 31,
                        length: 1,
                        tokenType: ETokenType.number,
                        tokenModifiers: [],
                    },
                ]);
            });

            it("should ignore macros inside the script macro", () => {
                const header = ":: Passage\n";
                const passage = "Macro: <<script>><<silently>><</script>>";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "script",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 9, 1, 15)
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                ]);
            });

            it("should create variables for the contents of a TwineScript script macro", () => {
                const header = ":: Passage\n";
                const passage =
                    "Macro: <<script TwineScript>>\n" +
                    "if ($items.includes('bloody knife')) {\n" +
                    "  _hit += 1;\n" +
                    "}\n" +
                    "<</script>>";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.references;

                expect(result).to.eql([
                    {
                        contents: "script",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 9, 1, 15)
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$items",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 4, 2, 10)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "_hit",
                        location: Location.create(
                            "fake-uri",
                            Range.create(3, 2, 3, 6)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });
        });

        describe("unknown macro arguments", () => {
            it("should produce semantic tokens for argument values of unknown macros", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a 'string' $var1 to true `'str' + $testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.tokens;

                expect(result).to.eql([
                    {
                        line: 1,
                        char: 12,
                        length: 1,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 14,
                        length: 8,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 23,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 29,
                        length: 2,
                        tokenType: ETokenType.operator,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 32,
                        length: 4,
                        tokenType: ETokenType.keyword,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 38,
                        length: 5,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 44,
                        length: 1,
                        tokenType: ETokenType.operator,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 46,
                        length: 6,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                ]);
            });

            it("should capture variable references for argument values of unknown macros", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a $var1 to _var2 `'str' + $testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$var1",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 14, 1, 19)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "_var2",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 28)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 38, 1, 44)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should not capture variable references for bare words that don't start with $ or _ for unknown macros", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a var1>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results).to.eql([
                    {
                        contents: "a",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 12, 1, 13)
                        ),
                        kind: OSugarCubeSymbolKind.UnknownMacro,
                    },
                ]);
            });

            it("should capture passage references for argument values for unknown macros", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a [[Passage Name]]>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.length).to.equal(2);
                expect(results[1]).to.eql({
                    contents: "Passage Name",
                    location: Location.create(
                        "fake-uri",
                        Range.create(1, 16, 1, 28)
                    ),
                    kind: TwineSymbolKind.Passage,
                });
            });
        });

        describe("Custom macro argument parsing", () => {
            it("should send the argument text to a macro's custom parse function", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a true 1 bare 'cont' $testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "a",
                });
                const allArgs: string[] = [];
                macro.parse = (args) => {
                    allArgs.push(args ?? "UNDEFINED");
                    return true;
                };
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();

                expect(allArgs).to.eql(["true 1 bare 'cont' $testy"]);
            });

            it("should stop parsing macro arguments if the macro's custom parse function returns true", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a true 1 bare 'cont' $testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "a",
                });
                macro.arguments = true;
                macro.parse = () => {
                    return true;
                };
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();

                // If there's no more parsing, then no non-macro tokens or references should be created
                expect(callbacks.tokens).to.eql([
                    {
                        line: 1,
                        char: 12,
                        length: 1,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    },
                ]);
                expect(callbacks.references).to.eql([
                    {
                        contents: "a",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 12, 1, 13)
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                ]);
            });

            it("should continue parsing macro arguments if the macro's custom parse function returns false", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a $testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "a",
                });
                macro.arguments = true;
                macro.parse = () => {
                    return false;
                };
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();

                expect(callbacks.tokens).to.eql([
                    {
                        line: 1,
                        char: 12,
                        length: 1,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 14,
                        length: 6,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                ]);
                expect(callbacks.references).to.eql([
                    {
                        contents: "a",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 12, 1, 13)
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 14, 1, 20)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });
        });

        describe("T3LT macro arguments", () => {
            it("should produce semantic tokens for base argument types", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a true 1 bare 'cont' $testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: [
                        "boolean &+ number &+ bareword &+ string &+ (bool | var)",
                    ],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const result = callbacks.tokens;

                expect(result).to.eql([
                    {
                        line: 1,
                        char: 12,
                        length: 1,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 14,
                        length: 4,
                        tokenType: ETokenType.keyword,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 19,
                        length: 1,
                        tokenType: ETokenType.number,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 26,
                        length: 6,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 33,
                        length: 6,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                ]);
            });

            it("should capture variable references for var types", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a true 1 bare 'cont' $testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: [
                        "boolean &+ number &+ bareword &+ (string |+ var | bool)",
                    ],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 33, 1, 39)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should produce semantic tokens for backticks used in text type arguments", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a `'str' + $testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["text"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const result = callbacks.tokens;

                expect(result).to.eql([
                    {
                        line: 1,
                        char: 12,
                        length: 1,
                        tokenType: ETokenType.function,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 15,
                        length: 5,
                        tokenType: ETokenType.string,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 21,
                        length: 1,
                        tokenType: ETokenType.operator,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 23,
                        length: 6,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                ]);
            });

            it("should capture variable references for backticks used in text type arguments", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a `'str' + $testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["text"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 29)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture references for link values", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a [[Passage Name<-Display text][$testy to 7]]>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["link"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage Name",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 16, 1, 28)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 44, 1, 50)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture passage references for passage values that are strings", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare 'Passage Name'>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ passage"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage Name",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 32)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should capture passage references for passage values that are bare words", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare Passage>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ passage"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 19, 1, 26)
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should capture variable references for receiver values", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare '$testy'>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 26)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture variable references for receiver values in backticks", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare `$testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 26)
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });
        });
    });

    describe("block comments", () => {
        it("should produce semantic tokens for a /* */ block comment", () => {
            const header = ":: Passage\n";
            const passage =
                "/* comments\n" + " more comments\n" + "  end comment */";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 1,
                    char: 0,
                    length: 11,
                    tokenType: ETokenType.comment,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 0,
                    length: 14,
                    tokenType: ETokenType.comment,
                    tokenModifiers: [],
                },
                {
                    line: 3,
                    char: 0,
                    length: 16,
                    tokenType: ETokenType.comment,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should ignore all contents inside a /* */ block comment", () => {
            const header = ":: Passage\n";
            const passage =
                "/* comments\n" +
                " $bare_variable [[ passage ]]\n" +
                "<<testy>>\n" +
                "end comment */";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should ignore all contents inside a /% %/ block comment", () => {
            const header = ":: Passage\n";
            const passage =
                "/% comments\n" +
                " $bare_variable [[ passage ]]\n" +
                "<<testy>>\n" +
                "end comment %/";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });

        it("should ignore all contents inside a <!-- --> block comment", () => {
            const header = ":: Passage\n";
            const passage =
                "<!-- comments\n" +
                " $bare_variable [[ passage ]]\n" +
                "<<testy>>\n" +
                "end comment -->";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);
            const macro = buildMacroInfo({
                name: "testy",
            });
            const mockFunction = ImportMock.mockFunction(
                macrosModule,
                "allMacros"
            ).returns({ testy: macro });

            parser?.parsePassageText(passage, header.length, state);
            mockFunction.restore();
            const result = callbacks.references;

            expect(result).to.be.empty;
        });
    });

    describe("html and svg attributes", () => {
        it("should capture a passage reference in an a tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <a data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 39, 2, 51)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a variable reference in an a tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <a data-passage="$tempy + 'Passage'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 39, 2, 45)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a passage reference in an area tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <area  data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 43, 2, 55)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in a button tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <button   data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 46, 2, 58)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in an audio tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <audio data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 43, 2, 55)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in an img tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <img  data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 42, 2, 54)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in an image tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <image data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 43, 2, 55)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in a source tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <source data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 44, 2, 56)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a passage reference in a video tag's data-passage attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                'data-passage example: <video data-passage="OtherPassage">.\n';
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "OtherPassage",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 43, 2, 55)
                    ),
                    kind: TwineSymbolKind.Passage,
                },
            ]);
        });

        it("should capture a variable reference in an a tag's data-setter attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <a data-setter="$thing to 'done'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$thing",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 38, 2, 44)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a variable reference in an area tag's data-setter attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <area  data-setter="$thing to 'done'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$thing",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 42, 2, 48)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a variable reference in a button tag's data-setter attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <button   data-setter="$thing to 'done'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$thing",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 45, 2, 51)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a variable reference in an sc-eval attribute directive", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <span sc-eval:id="'pre-' + _id + '-suf'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "_id",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 49, 2, 52)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should capture a variable reference in an @ attribute directive", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                `data-passage example: <span @id="'pre-' + _id + '-suf'">.\n`;
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "_id",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 42, 2, 45)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });
    });

    describe("html", () => {
        it("should create an embedded html document for the passage", () => {
            const header = ":: Passage\n";
            const passage = "Contents!\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.embeddedDocuments[0];

            expect(callbacks.embeddedDocuments.length).to.equal(1);
            expect(result.document.getText()).to.eql("Contents!\n");
            expect(result.document.languageId).to.eql("html");
            expect(result.range).to.eql(Range.create(1, 0, 2, 0));
            expect(result.isPassage).to.be.true;
        });

        it("should create an embedded css document for the style tag", () => {
            const header = ":: Passage\n";
            const passage = "HTML: <style>p {\n  color: #26b72b;\n}</style>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.embeddedDocuments[1];

            expect(callbacks.embeddedDocuments.length).to.equal(2); // HTML doc for the full passage + CSS
            expect(result.document.getText()).to.eql(
                "p {\n  color: #26b72b;\n}"
            );
            expect(result.document.languageId).to.eql("css");
            expect(result.range).to.eql(Range.create(1, 13, 3, 1));
            expect(result.isPassage).to.be.false;
        });
    });

    describe("custom styles", () => {
        it("should create semantic tokens for inline CSS style lists", () => {
            const header = ":: Passage\n";
            const passage = "@@color: red; Text@@\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 1,
                    char: 0,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 2,
                    length: 5,
                    tokenType: ETokenType.property,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 9,
                    length: 3,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 18,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should create semantic tokens for inline class and ID lists", () => {
            const header = ":: Passage\n";
            const passage = "@@#alfa;.bravo#charlie .delta; Text@@\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 1,
                    char: 0,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 2,
                    length: 5,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 8,
                    length: 6,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 14,
                    length: 8,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 23,
                    length: 6,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 35,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should create semantic tokens for block style lists", () => {
            const header = ":: Passage\n";
            const passage = "@@#alfa;.bravo;color: red;\nText@@\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;

            expect(result).to.eql([
                {
                    line: 1,
                    char: 0,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 2,
                    length: 5,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 8,
                    length: 6,
                    tokenType: ETokenType.class,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 15,
                    length: 5,
                    tokenType: ETokenType.property,
                    tokenModifiers: [],
                },
                {
                    line: 1,
                    char: 22,
                    length: 3,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 4,
                    length: 2,
                    tokenType: ETokenType.decorator,
                    tokenModifiers: [],
                },
            ]);
        });
    });

    describe("errors", () => {
        describe("special passages", () => {
            it("should warn on a StoryDisplayTitle passage before version 2.31.0", () => {
                const header = ":: StoryDisplayTitle\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "StoryDisplayTitle",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(0, 3, 0, 20),
                    },
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.30.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "StoryDisplayTitle isn't supported in SugarCube version 2.30.0"
                );
                expect(result.range).to.eql(Range.create(0, 3, 0, 20));
            });

            it("should warn on a StoryInterface passage before version 2.18.0", () => {
                const header = ":: StoryInterface\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "StoryInterface",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(0, 3, 0, 17),
                    },
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.17.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "StoryInterface isn't supported in SugarCube version 2.17.0"
                );
                expect(result.range).to.eql(Range.create(0, 3, 0, 17));
            });

            it("should warn on a StoryShare passage as of version 2.37.0", () => {
                const header = ":: StoryShare\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "StoryShare",
                    location: {
                        uri: "fake-uri",
                        range: Range.create(0, 3, 0, 13),
                    },
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.37.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "StoryShare is deprecated as of SugarCube version 2.37.0"
                );
                expect(result.range).to.eql(Range.create(0, 3, 0, 13));
            });

            it("should warn on a Twine.audio tagged passage before version 2.24.0", () => {
                const header = ":: Passage [Twine.audio]\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                });
                state.currentPassage.tags = [
                    {
                        contents: "Twine.audio",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 12, 0, 23)
                        ),
                    },
                ];
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.23.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "Twine.audio isn't supported in SugarCube version 2.23.0"
                );
                expect(result.range).to.eql(Range.create(0, 12, 0, 23));
            });

            it("should warn on a Twine.video tagged passage before version 2.24.0", () => {
                const header = ":: Passage [Twine.video]\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                });
                state.currentPassage.tags = [
                    {
                        contents: "Twine.video",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 12, 0, 23)
                        ),
                    },
                ];
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.23.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "Twine.video isn't supported in SugarCube version 2.23.0"
                );
                expect(result.range).to.eql(Range.create(0, 12, 0, 23));
            });

            it("should warn on a Twine.vtt tagged passage before version 2.24.0", () => {
                const header = ":: Passage [Twine.vtt]\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                });
                state.currentPassage.tags = [
                    {
                        contents: "Twine.vtt",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 12, 0, 23)
                        ),
                    },
                ];
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.23.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "Twine.vtt isn't supported in SugarCube version 2.23.0"
                );
                expect(result.range).to.eql(Range.create(0, 12, 0, 23));
            });

            it("should error on a passage with multiple media tags", () => {
                const header = ":: Passage [Twine.image, Twine.audio]\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                });
                state.currentPassage.tags = [
                    {
                        contents: "Twine.image",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 12, 0, 23)
                        ),
                    },
                    {
                        contents: "Twine.audio",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 25, 0, 31)
                        ),
                    },
                ];
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.37.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.errors;

                expect(callbacks.errors.length).to.equal(2);
                expect(result[0].severity).to.eql(DiagnosticSeverity.Error);
                expect(result[0].message).to.include(
                    "Multiple media passage tags aren't allowed"
                );
                expect(result[0].range).to.eql(Range.create(0, 12, 0, 23));
                expect(result[1].severity).to.eql(DiagnosticSeverity.Error);
                expect(result[1].message).to.include(
                    "Multiple media passage tags aren't allowed"
                );
                expect(result[1].range).to.eql(Range.create(0, 25, 0, 31));
            });

            it("should warn on a bookmark-tagged passage as of version 2.37.0", () => {
                const header = ":: Passage [bookmark]\n";
                const passage = "Stuff\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                });
                state.currentPassage.tags = [
                    {
                        contents: "bookmark",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 12, 0, 23)
                        ),
                    },
                ];
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.37.0",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "bookmark is deprecated as of SugarCube version 2.37.0"
                );
                expect(result.range).to.eql(Range.create(0, 12, 0, 23));
            });
        });

        describe("macros", () => {
            it("should error on a macro when the story format's version is earlier than when the macro was added to SugarCube", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.1",
                };
                const parser = uut.getSugarCubeParser("2.1");
                const macro = buildMacroInfo({
                    name: "testy",
                });
                macro.since = "2.1.1";
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "`testy` isn't available until SugarCube version 2.1.1 but your StoryFormat version is 2.1"
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 19));
            });

            it("should error on a macro when the story format's version is later than when the macro was removed from SugarCube", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.1",
                };
                const parser = uut.getSugarCubeParser("2.1");
                const macro = buildMacroInfo({
                    name: "testy",
                });
                macro.removed = "2.1";
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "`testy` was removed in SugarCube version 2.1 and your StoryFormat version is 2.1"
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 19));
            });

            it("should error on a closing macro that isn't a container", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <</testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "testy",
                    container: false,
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "<<testy>> macro isn't a container and so doesn't have a closing macro"
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 20));
            });

            it("should error on a container macro that's missing its closing macro", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Closing macro <</testy>> not found"
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 19));
            });

            it("should warn on a container macro whose closing macro uses the alternate 'end' format", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<testy>><<endtesty>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "<<endtesty>> is deprecated; use <</testy>> instead"
                );
                expect(result.range).to.eql(Range.create(1, 19, 1, 31));
            });

            it("should error on a container macro that's missing its opening macro", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <</testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ testy: macro });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Opening macro <<testy>> not found"
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 20));
            });

            it("should error on a child macro that isn't contained in its required parent", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a>>\n<<b>>\n<<b>>\n<</a>>\n<<b>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 2 }];
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macroA, b: macroB });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include("Must be inside <<a>> macro");
                expect(result.range).to.eql(Range.create(5, 0, 5, 5));
            });

            it("should error on a container macro that has too many children", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a>>\n<<b>>\n<<b>>\n<<b>>\n<</a>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 2 }];
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macroA, b: macroB });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Child macro <<b>> can be used at most 2 times"
                );
                expect(result.range).to.eql(Range.create(4, 0, 4, 5));
            });

            it("should not error on a nested container macro that has just enough children", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a>>\n<<b>>\n<<a>>\n<<b>>\n<</a>>\n<</a>>\n" +
                    "<<a>>\n<<a>>\n<<b>>\n<</a>>\n<<b>>\n<</a>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 1 }];
                const mockFunction = ImportMock.mockFunction(
                    macrosModule,
                    "allMacros"
                ).returns({ a: macroA, b: macroB });

                parser?.parsePassageText(passage, header.length, state);
                mockFunction.restore();
                const result = callbacks.errors;

                expect(result).to.be.empty;
            });

            describe("macro arguments", () => {
                it("should raise an error on a malformed string", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 'unterminated>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Unable to parse macro argument: unterminated single quoted string"
                    );
                    expect(result.range).to.eql(Range.create(1, 14, 1, 27));
                });

                it("should raise a warning for no arguments to a macro that expects them", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = true;
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include("Expected arguments");
                    expect(result.range).to.eql(Range.create(1, 12, 1, 13));
                });

                it("should raise a warning for arguments to a macro that doesn't take them", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a testy whoops = 7>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = false;
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include("Expected no arguments");
                    expect(result.range).to.eql(Range.create(1, 14, 1, 30));
                });

                it("should do nothing for a macro whose arguments are undefined", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a [no error here]>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = undefined;
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.errors;

                    expect(result).to.be.empty;
                });

                it("should raise an error for a non-boolean argument to a macro that takes a boolean", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 1>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["boolean"],
                    });
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Argument is not a boolean"
                    );
                    expect(result.range).to.eql(Range.create(1, 14, 1, 15));
                });

                it("should not raise an error for a closing tag of a container macro that takes an argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 1>><</a>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        container: true,
                        args: ["number"],
                    });
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const result = callbacks.errors;

                    expect(result).to.be.empty;
                });

                it("should raise a warning for a closing macro with any arguments", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 1>><</a flooby>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        container: true,
                        args: ["number"],
                    });
                    const mockFunction = ImportMock.mockFunction(
                        macrosModule,
                        "allMacros"
                    ).returns({ a: macro });

                    parser?.parsePassageText(passage, header.length, state);
                    mockFunction.restore();
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Closing macros don't take arguments"
                    );
                    expect(result.range).to.eql(Range.create(1, 22, 1, 28));
                });

                describe("T3LT macro arguments", () => {
                    it("should error on a receiver value that's not a string", () => {
                        const header = ":: Passage\n";
                        const passage = "Let's go: <<a bare $testy>>\n";
                        const callbacks = new MockCallbacks();
                        const state = buildParsingState({
                            content: header + passage,
                            callbacks: callbacks,
                        });
                        const parser = uut.getSugarCubeParser(undefined);
                        const macro = buildMacroInfoWithArgs({
                            name: "a",
                            args: ["bareword &+ receiver"],
                        });
                        const mockFunction = ImportMock.mockFunction(
                            macrosModule,
                            "allMacros"
                        ).returns({ a: macro });

                        parser?.parsePassageText(passage, header.length, state);
                        mockFunction.restore();
                        const [result] = callbacks.errors;

                        expect(callbacks.errors.length).to.equal(1);
                        expect(result.severity).to.eql(
                            DiagnosticSeverity.Warning
                        );
                        expect(result.message).to.include(
                            "Do you mean for this receiver value to be a bare variable?"
                        );
                        expect(result.range).to.eql(Range.create(1, 19, 1, 25));
                    });
                });
            });
        });

        describe("html and svg attributes", () => {
            it("should error on an HTML tag with both data-passage and href attributes", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    'This is no good: <a href="https://tech.omfg" data-passage = "OtherPassage">.\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    `Both "data-passage" and "href" attributes aren't allowed`
                );
                expect(result.range).to.eql(Range.create(2, 45, 2, 57));
            });

            it("should error on an HTML tag whose data-setter attribute has an @ evaluation directive", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    'This is no good: <a @data-setter = "_id to 7">.\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    `"data-setter" can't have an evaluation directive`
                );
                expect(result.range).to.eql(Range.create(2, 20, 2, 21));
            });

            it("should error on an HTML tag whose data-setter attribute has an sc-eval evaluation directive", () => {
                const header = ":: Passage\n";
                const passage =
                    "Some content.\n" +
                    'This is no good: <a sc-eval:data-setter = "_id to 7">.\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    `"data-setter" can't have an evaluation directive`
                );
                expect(result.range).to.eql(Range.create(2, 20, 2, 28));
            });
        });
    });
});
