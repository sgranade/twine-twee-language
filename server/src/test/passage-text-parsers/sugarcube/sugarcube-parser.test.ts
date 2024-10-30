import "mocha";
import { expect } from "chai";
import { ImportMock } from "ts-mock-imports";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../semantic-tokens";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import { buildMacroInfo } from "./macros/macro-builders";

import * as macrosModule from "../../../passage-text-parsers/sugarcube/macros";
import * as uut from "../../../passage-text-parsers/sugarcube";
import {
    Parameters,
    parseMacroParameters,
} from "../../../passage-text-parsers/sugarcube/sc2/t3lt-parameters";

describe("SugarCube Parser", () => {
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

            expect(callbacks.tokens.length).to.equal(1);
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

        describe("macro arguments", () => {
            it("should produce semantic tokens for argument values", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a 'string' $var1 to true>>\n";
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
                ]);
            });

            it("should capture variable references for argument values", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a $var1 to _var2>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.length).to.equal(3);
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
                ]);
            });

            it("should not capture variable references for bare words that don't start with $ or _", () => {
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

            it("should capture passage references for argument values", () => {
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

                it("should raise an error for a non-boolean argument to a macro that takes a boolean", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 1>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = ["boolean"];
                    const parsedArguments = parseMacroParameters(
                        macro.arguments,
                        {}
                    );
                    macro.parsedArguments =
                        parsedArguments instanceof Parameters
                            ? parsedArguments
                            : undefined;
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
                    const macro = buildMacroInfo({
                        name: "a",
                        container: true,
                    });
                    macro.arguments = ["number"];
                    const parsedArguments = parseMacroParameters(
                        macro.arguments,
                        {}
                    );
                    macro.parsedArguments =
                        parsedArguments instanceof Parameters
                            ? parsedArguments
                            : undefined;
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
                    const macro = buildMacroInfo({
                        name: "a",
                        container: true,
                    });
                    macro.arguments = ["number"];
                    const parsedArguments = parseMacroParameters(
                        macro.arguments,
                        {}
                    );
                    macro.parsedArguments =
                        parsedArguments instanceof Parameters
                            ? parsedArguments
                            : undefined;
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
            });
        });
    });
});
