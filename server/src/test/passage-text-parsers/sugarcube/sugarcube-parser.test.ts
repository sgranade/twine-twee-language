import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../tokens";
import { OSugarCubeSymbolKind } from "../../../passage-text-parsers/sugarcube/types";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";

import * as uut from "../../../passage-text-parsers/sugarcube";

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
            const passage = "Some content.\n" + "This is a $bareVariable.\n";
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
                    contents: "bareVariable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 11, 2, 23)
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
                    contents: "bareVariable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 11, 2, 23)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "prop",
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
                "Some content.\n" + "This is a $bareVariable[$otherVar].\n";
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
                    contents: "bareVariable",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 11, 2, 23)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "otherVar",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 25, 2, 33)
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
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

    describe("macros", () => {});

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
    });
});
