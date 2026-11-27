import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { TwineSymbolKind } from "../../../project-index";
import { ETokenModifier, ETokenType } from "../../../semantic-tokens";
import {
    MacroLocationInfo,
    OSugarCubeSymbolKind,
} from "../../../passage-text-parsers/sugarcube/types";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import {
    buildMacroInfo,
    buildMacroInfoWithArgs,
} from "./macros/macro-builders";

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
                        Range.create(0, 12, 0, 22),
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
                        Range.create(0, 12, 0, 23),
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
                        Range.create(0, 12, 0, 23),
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
                        Range.create(0, 12, 0, 23),
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
                        Range.create(0, 12, 0, 23),
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);

            expect(callbacks.embeddedDocuments).to.be.empty;
        });

        it("should create an embedded deferred JavaScript document for a script-tagged passage", () => {
            const header = ":: Passage [script]\n";
            const passage = "\n var1['prop'] = { other: 1}\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            state.currentPassage.tags = [
                {
                    contents: "script",
                    location: Location.create(
                        "fake-uri",
                        Range.create(0, 12, 0, 18),
                    ),
                },
            ];
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.embeddedDocuments[0];

            expect(callbacks.embeddedDocuments.length).to.equal(1);
            expect(result.document.getText()).to.eql(
                "\n var1['prop'] = { other: 1}\n",
            );
            expect(result.document.languageId).to.eql("javascript");
            expect(result.range).to.eql(Range.create(1, 0, 3, 0));
            expect(result.deferToStoryFormat).to.be.true;
            expect(result.isPassage).to.be.false;
        });

        it("should parse variables in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage = "\n State.variables.var1.prop = { other: 1}\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 17, 2, 21),
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                    sigilOutsideRange: true,
                },
                {
                    contents: "$var1.prop",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 22, 2, 26),
                    ),
                    kind: OSugarCubeSymbolKind.PropertySet,
                },
                {
                    contents: "$var1.prop.other",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 31, 2, 36),
                    ),
                    kind: OSugarCubeSymbolKind.PropertySet,
                },
            ]);
        });

        it("should not treat browser, jQuery globals, or bare names as variables in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage =
                "\nlocation.reload(); $('#x').hide(); jQuery.fx.off = v;\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references.map((r) => r.contents);

            expect(result).to.eql([]);
        });

        it("should not treat SugarCube's built-in functions as variables in a script passage", () => {
            const header = ":: Passage [script]\n";
            const builtInFunctions = [
                "clone",
                "either",
                "forget",
                "hasVisited",
                "importScripts",
                "importStyles",
                "lastVisited",
                "memorize",
                "passage",
                "previous",
                "random",
                "randomFloat",
                "recall",
                "setPageElement",
                "tags",
                "temporary",
                "time",
                "triggerEvent",
                "turns",
                "variables",
                "visited",
                "visitedTags",
            ];
            const passage =
                "\n" +
                builtInFunctions.map((f) => `${f}();`).join(" ") +
                " v;\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references.map((r) => r.contents);

            expect(result).to.eql([]);
        });

        it("should parse variables that include line continuations in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage =
                "\n State.variables.var1 = 'Example string\\\nwith line continuation and break'; State.variables.var2 = 1\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result).to.eql([
                {
                    contents: "$var1",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 17, 2, 21),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
                    sigilOutsideRange: true,
                },
                {
                    contents: "$var2",
                    location: Location.create(
                        "fake-uri",
                        Range.create(3, 51, 3, 55),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
                    sigilOutsideRange: true,
                },
            ]);
        });

        it("should capture semantic tokens that include line continuations in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage =
                "\n var1 = { first: 'Example string\\\nwith line continuation and break'}\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.tokens;
            expect(result).to.eql([
                {
                    line: 2,
                    char: 1,
                    length: 4,
                    tokenType: ETokenType.variable,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 6,
                    length: 1,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
                {
                    line: 2,
                    char: 10,
                    length: 5,
                    tokenType: ETokenType.property,
                    tokenModifiers: [],
                },
                // The string will be broken into two single-line semantic tokens
                {
                    line: 2,
                    char: 17,
                    length: 16,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
                {
                    line: 3,
                    char: 0,
                    length: 33,
                    tokenType: ETokenType.string,
                    tokenModifiers: [],
                },
            ]);
        });

        it("should capture bare and property assignments as writes in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage =
                "\n State.variables.a = 1; State.variables.b.c = 2\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references.map((r) => [
                r.contents,
                r.kind,
            ]);

            expect(result).to.eql([
                ["$a", OSugarCubeSymbolKind.VariableSet],
                ["$b", OSugarCubeSymbolKind.Variable],
                ["$b.c", OSugarCubeSymbolKind.PropertySet],
            ]);
        });

        it("should capture a property write in a <<run>> macro", () => {
            const header = ":: Passage\n";
            const passage = "<<run $a.b = 1>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references
                .filter((r) => r.contents.startsWith("$a"))
                .map((r) => [r.contents, r.kind]);

            expect(result).to.eql([
                ["$a", OSugarCubeSymbolKind.Variable],
                ["$a.b", OSugarCubeSymbolKind.PropertySet],
            ]);
        });

        describe("State Roots in TwineScript", () => {
            const referencesFor = (passage: string) => {
                const header = ":: Passage\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                uut.getSugarCubeParser(undefined)?.parsePassageText(
                    passage,
                    header.length,
                    state,
                );
                return callbacks.references.filter(
                    (r) => r.contents !== "run" && r.contents !== "set",
                );
            };

            it("should capture State.setVar with a literal key as a variable set", () => {
                // No arrange

                const result = referencesFor(
                    "<<run State.setVar('$x', 5)>>",
                ).map((r) => [r.contents, r.kind]);

                expect(result).to.eql([
                    ["$x", OSugarCubeSymbolKind.VariableSet],
                ]);
            });

            it("should record a spread of a state root as a shape source", () => {
                // No arrange

                const result = referencesFor(
                    "<<run State.variables.o = {...State.variables.base, a: 1}>>",
                ).find((r) => r.contents === "$o");

                expect(result?.shapeSources).to.eql(["$base"]);
                expect(result?.opaque).to.not.be.true;
            });

            it("should record a copy through a state root as a shape source", () => {
                // No arrange

                const result = referencesFor(
                    "<<set _p to State.variables.player>>",
                ).find((r) => r.contents === "_p");

                expect(result?.shapeSources).to.eql(["$player"]);
                expect(result?.opaque).to.not.be.true;
            });

            it("should record a sigiled variable assigned through a state root as a shape source", () => {
                // No arrange

                const result = referencesFor(
                    "<<run State.variables.r = $a>>",
                ).find((r) => r.contents === "$r");

                expect(result?.shapeSources).to.eql(["$a"]);
            });

            it("should not capture a bare identifier as a story variable", () => {
                // No arrange

                const result = referencesFor(
                    "<<run State.variables.r = fn()>>",
                ).map((r) => r.contents);

                expect(result).to.eql(["$r"]);
            });

            it("should locate a variable reached through a state root without its sigil", () => {
                const result = referencesFor(
                    "<<set _p to State.variables.player>>",
                ).find((r) => r.contents === "$player");

                // `player` is at 28-34 in `<<set _p to State.variables.player>>`
                expect(result?.location.range).to.eql(
                    Range.create(1, 28, 1, 34),
                );
            });

            it("should locate a State.setVar key without its sigil", () => {
                const result = referencesFor(
                    "<<run State.setVar('$x', 5)>>",
                ).find((r) => r.contents === "$x");

                expect(result?.location.range).to.eql(
                    Range.create(1, 21, 1, 22),
                );
            });

            it("should record a copy through variables() as a shape source", () => {
                const result = referencesFor(
                    "<<set $x to variables().y>>",
                ).find((r) => r.contents === "$x");

                expect(result?.shapeSources).to.eql(["$y"]);
                expect(result?.opaque).to.not.be.true;
            });

            it("should record a copy through State.getVar as a shape source", () => {
                const result = referencesFor(
                    "<<set $x to State.getVar('_y')>>",
                ).find((r) => r.contents === "$x");

                expect(result?.shapeSources).to.eql(["_y"]);
                expect(result?.opaque).to.not.be.true;
            });

            it("should record a copy through SugarCube.State as a shape source", () => {
                const result = referencesFor(
                    "<<set $x to SugarCube.State.variables.y>>",
                ).find((r) => r.contents === "$x");

                expect(result?.shapeSources).to.eql(["$y"]);
                expect(result?.opaque).to.not.be.true;
            });
        });

        it("should capture an assignment in a <<print>> macro as a property read", () => {
            const header = ":: Passage\n";
            const passage = "<<print $a.b = 1>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references
                .filter((r) => r.contents.startsWith("$a"))
                .map((r) => [r.contents, r.kind]);

            expect(result).to.eql([
                ["$a", OSugarCubeSymbolKind.Variable],
                ["$a.b", OSugarCubeSymbolKind.Property],
            ]);
        });

        it("should capture a <<set>> of a call's result as an opaque assignment", () => {
            const header = ":: Passage\n";
            const passage = "<<set _r to fn()>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references
                .filter((r) => r.contents === "_r")
                .map((r) => [r.kind, r.opaque]);

            expect(result).to.eql([[OSugarCubeSymbolKind.VariableSet, true]]);
        });

        it("should not capture an assignment in a <<print>> macro as opaque", () => {
            const header = ":: Passage\n";
            const passage = "<<print $x = fn()>>";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references
                .filter((r) => r.contents === "$x")
                .map((r) => [r.kind, r.opaque]);

            expect(result).to.eql([[OSugarCubeSymbolKind.Variable, undefined]]);
        });

        it("should capture State.temporary variables in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage = "\n State.temporary.var.prop = 1\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result.length).to.eql(2);
            expect(result[0]).to.eql({
                contents: "_var",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 17, 2, 20),
                ),
                kind: OSugarCubeSymbolKind.Variable,
                sigilOutsideRange: true,
            });
            expect(result[1]).to.eql({
                contents: "_var.prop",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 21, 2, 25),
                ),
                kind: OSugarCubeSymbolKind.PropertySet,
            });
        });

        it("should capture State.variables variables in a script passage", () => {
            const header = ":: Passage [script]\n";
            const passage = "\n State.variables.var.prop = 1\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                content: header + passage,
                callbacks: callbacks,
            });
            state.currentPassage = buildPassage({
                label: "Passage",
                isScript: true,
            });
            const parser = uut.getSugarCubeParser(undefined);

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references;

            expect(result.length).to.eql(2);
            expect(result[0]).to.eql({
                contents: "$var",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 17, 2, 20),
                ),
                kind: OSugarCubeSymbolKind.Variable,
                sigilOutsideRange: true,
            });
            expect(result[1]).to.eql({
                contents: "$var.prop",
                location: Location.create(
                    "fake-uri",
                    Range.create(2, 21, 2, 25),
                ),
                kind: OSugarCubeSymbolKind.PropertySet,
            });
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
                        Range.create(2, 10, 2, 24),
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
                        Range.create(2, 10, 2, 23),
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "$bareVariable.prop",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 24, 2, 28),
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
                        Range.create(2, 10, 2, 23),
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
                {
                    contents: "_otherVar",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 24, 2, 33),
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

        it("should not capture the built-in variables $args, _args, or _contents (for widgets)", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" +
                "<<widget>> $args _args _contents <</widget>>\n";
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
                    contents: "widget",
                    kind: OSugarCubeSymbolKind.KnownMacro,
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 2, 2, 8),
                    ),
                },
            ]);
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

        it("should produce semantic tokens for a bare variable and a string (and its containing property) used in bracket property access", () => {
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

            expect(callbacks.tokens.length).to.equal(3);
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
                {
                    line: 2,
                    char: 25,
                    length: 6,
                    tokenType: ETokenType.property,
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
        it("should produce semantic tokens for the brackets in an empty [[]] link", () => {
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
            const [leftBracketToken, rightBracketToken] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(2);
            expect(leftBracketToken).to.eql({
                line: 2,
                char: 12,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
            expect(rightBracketToken).to.eql({
                line: 2,
                char: 14,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
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
            const [leftBracketToken, targetToken, rightBracketToken] =
                callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(3);
            expect(leftBracketToken).to.eql({
                line: 2,
                char: 12,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
            expect(rightBracketToken).to.eql({
                line: 2,
                char: 30,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
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
                    char: 12,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
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
                {
                    line: 2,
                    char: 32,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                        Range.create(2, 15, 2, 29),
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
                        Range.create(2, 25, 2, 31),
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
            const [
                leftBracketToken,
                displayToken,
                barToken,
                targetToken,
                rightBracketToken,
            ] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(5);
            expect(leftBracketToken).to.eql({
                line: 2,
                char: 12,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
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
            expect(rightBracketToken).to.eql({
                line: 2,
                char: 49,
                length: 2,
                tokenType: ETokenType.operator,
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
                        Range.create(2, 35, 2, 49),
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
            const [
                leftBracketToken,
                displayToken,
                arrowToken,
                targetToken,
                rightBracketToken,
            ] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(5);
            expect(leftBracketToken).to.eql({
                line: 2,
                char: 12,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
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
            expect(rightBracketToken).to.eql({
                line: 2,
                char: 50,
                length: 2,
                tokenType: ETokenType.operator,
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
                        Range.create(2, 36, 2, 50),
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
            const [
                leftBracketToken,
                targetToken,
                arrowToken,
                displayToken,
                rightBracketToken,
            ] = callbacks.tokens;

            expect(callbacks.tokens.length).to.equal(5);
            expect(leftBracketToken).to.eql({
                line: 2,
                char: 12,
                length: 2,
                tokenType: ETokenType.operator,
                tokenModifiers: [],
            });
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
            expect(rightBracketToken).to.eql({
                line: 2,
                char: 52,
                length: 2,
                tokenType: ETokenType.operator,
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
                        Range.create(2, 15, 2, 29),
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
                    char: 12,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
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
                    tokenType: ETokenType.operator,
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
                {
                    line: 2,
                    char: 43,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                        Range.create(2, 15, 2, 29),
                    ),
                    kind: TwineSymbolKind.Passage,
                },
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 32, 2, 38),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 28, 2, 34),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                    char: 12,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
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
                    char: 49,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                {
                    line: 2,
                    char: 62,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                        Range.create(2, 35, 2, 49),
                    ),
                    kind: TwineSymbolKind.Passage,
                },
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 52, 2, 58),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 48, 2, 54),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                    char: 12,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
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
                    char: 50,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                {
                    line: 2,
                    char: 63,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                        Range.create(2, 36, 2, 50),
                    ),
                    kind: TwineSymbolKind.Passage,
                },
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 53, 2, 59),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 49, 2, 55),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                    char: 12,
                    length: 2,
                    tokenType: ETokenType.operator,
                    tokenModifiers: [],
                },
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
                    char: 52,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                {
                    line: 2,
                    char: 65,
                    length: 2,
                    tokenType: ETokenType.operator,
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
                        Range.create(2, 15, 2, 29),
                    ),
                    kind: TwineSymbolKind.Passage,
                },
                {
                    contents: "$tempy",
                    location: Location.create(
                        "fake-uri",
                        Range.create(2, 54, 2, 60),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 50, 2, 56),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
            const macro = buildMacroInfo({ name: "testy" });
            macro.deprecated = "2.1";
            const parser = uut.getSugarCubeParser("2.1", {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
            const result = callbacks.references[0];

            expect(callbacks.references.length).to.equal(1);
            expect(result).to.eql({
                contents: "testy",
                location: Location.create(
                    "fake-uri",
                    Range.create(1, 9, 1, 14),
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            let macroArgs: string | undefined;
            let macroArgsIndex: number | undefined;
            macro.parseArgs = (args, argsIndex) => {
                macroArgs = args;
                macroArgsIndex = argsIndex;
                return true;
            };
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);

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
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: testyMacro, kid: kidMacro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);

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
                        Range.create(1, 9, 1, 15),
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
                            Range.create(1, 9, 1, 15),
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
                            Range.create(1, 9, 1, 15),
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$items",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 4, 2, 10),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "_hit",
                        location: Location.create(
                            "fake-uri",
                            Range.create(3, 2, 3, 6),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$items.includes",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 11, 2, 19),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                        isCallee: true,
                    },
                ]);
            });

            it("should create variables for the contents of a JavaScript script macro", () => {
                const header = ":: Passage\n";
                const passage =
                    "Macro: <<script>>\n" +
                    "if (State.variables.items.includes('bloody knife')) {\n" +
                    "  State.temporary.hit += 1;\n" +
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
                            Range.create(1, 9, 1, 15),
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$items",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 20, 2, 25),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                        sigilOutsideRange: true,
                    },
                    {
                        contents: "_hit",
                        location: Location.create(
                            "fake-uri",
                            Range.create(3, 18, 3, 21),
                        ),
                        kind: OSugarCubeSymbolKind.VariableSet,
                        sigilOutsideRange: true,
                    },
                    {
                        contents: "$items.includes",
                        location: Location.create(
                            "fake-uri",
                            Range.create(2, 26, 2, 34),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                        isCallee: true,
                    },
                ]);
            });

            it("should not capture the variable `output` used in a JavaScript script macro", () => {
                const header = ":: Passage\n";
                const passage =
                    "Macro: <<script>>\n" +
                    "output.wiki('Added!');\n" +
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
                            Range.create(1, 9, 1, 15),
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                ]);
            });

            it("should set a deferred embedded document for the contents of a JavaScript script macro", () => {
                const header = ":: Passage\n";
                const passage =
                    "Macro: <<script>>\n" +
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
                // The first embedded document is the entire passage
                const [, result] = callbacks.embeddedDocuments;

                expect(result.document.getText()).to.eql(
                    "\nif ($items.includes('bloody knife')) {\n" +
                        "  _hit += 1;\n" +
                        "}\n",
                );
                expect(result.document.languageId).to.eql("javascript");
                expect(result.range).to.eql(Range.create(1, 17, 5, 0));
                expect(result.deferToStoryFormat).to.be.true;
            });

            it("should create variables for the contents of a set macro", () => {
                const header = ":: Passage\n";
                const passage = "Macro: <<set $tempy to {other: 1}>>";
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
                        contents: "set",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 9, 1, 12),
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$tempy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 13, 1, 19),
                        ),
                        kind: OSugarCubeSymbolKind.VariableSet,
                    },
                    {
                        contents: "$tempy.other",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 24, 1, 29),
                        ),
                        kind: OSugarCubeSymbolKind.PropertySet,
                    },
                ]);
            });
        });

        describe("unknown macro arguments", () => {
            it("should produce semantic tokens for argument values of unknown macros", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a 'string' $var1 to true `'str' + $testy` [$var2, $var3] {'one': $var4}>>\n";
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
                    {
                        line: 1,
                        char: 55,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 62,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 71,
                        length: 3,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 77,
                        length: 5,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                ]);
            });

            it("should capture variable references for argument values of unknown macros", () => {
                const header = ":: Passage\n";
                const passage =
                    "Let's go: <<a $var1 to _var2 `'str' + $testy` [$var2, _var3] {'one': $var4}>>\n";
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
                            Range.create(1, 14, 1, 19),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "_var2",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 28),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 38, 1, 44),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$var2",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 47, 1, 52),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "_var3",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 54, 1, 59),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$var4",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 69, 1, 74),
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
                            Range.create(1, 12, 1, 13),
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
                        Range.create(1, 16, 1, 28),
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
                const macro = buildMacroInfo({
                    name: "a",
                });
                const allArgs: string[] = [];
                macro.parseArgs = (args) => {
                    allArgs.push(args ?? "UNDEFINED");
                    return true;
                };
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);

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
                const macro = buildMacroInfo({
                    name: "a",
                });
                macro.arguments = true;
                macro.parseArgs = () => {
                    return true;
                };
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);

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
                            Range.create(1, 12, 1, 13),
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
                const macro = buildMacroInfo({
                    name: "a",
                });
                macro.arguments = true;
                macro.parseArgs = () => {
                    return false;
                };
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);

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
                            Range.create(1, 12, 1, 13),
                        ),
                        kind: OSugarCubeSymbolKind.KnownMacro,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 14, 1, 20),
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: [
                        "boolean &+ number &+ bareword &+ string &+ (bool | var)",
                    ],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

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
                        tokenType: ETokenType.keyword,
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: [
                        "boolean &+ number &+ bareword &+ (string |+ var | bool)",
                    ],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 33, 1, 39),
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["text"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["text"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 23, 1, 29),
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["link"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage Name",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 16, 1, 28),
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 44, 1, 50),
                        ),
                        kind: OSugarCubeSymbolKind.VariableSet,
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ passage"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage Name",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 32),
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
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ passage"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "Passage",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 19, 1, 26),
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should capture a set variable for receiver values", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare '$testy'>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 26),
                        ),
                        kind: OSugarCubeSymbolKind.VariableSet,
                        opaque: true,
                    },
                ]);
            });

            it("should capture a quoted receiver's property path as a variable read and an opaque property write", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare '$p.stats'>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references
                    .slice(1)
                    .map((r) => [r.contents, r.kind, r.opaque]);

                expect(results).to.eql([
                    ["$p", OSugarCubeSymbolKind.Variable, undefined],
                    ["$p.stats", OSugarCubeSymbolKind.PropertySet, true],
                ]);
            });

            it("should capture variable reads for receiver values in backticks", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare `$testy`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references;

                expect(results.slice(1)).to.eql([
                    {
                        contents: "$testy",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 20, 1, 26),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture only variable reads for a computed receiver in backticks", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare `$a[_i]`>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const results = callbacks.references
                    .slice(1)
                    .map((r) => [r.contents, r.kind, r.opaque]);

                expect(results).to.eql([
                    ["$a", OSugarCubeSymbolKind.Variable, undefined],
                    ["_i", OSugarCubeSymbolKind.Variable, undefined],
                ]);
            });

            it("should capture nothing for a quoted receiver that isn't an assignment target", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <<a bare '$junk + 1'>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfoWithArgs({
                    name: "a",
                    args: ["bareword &+ receiver"],
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const references = callbacks.references.slice(1);
                const receiverTokens = callbacks.tokens.filter(
                    (t) => t.char >= 19,
                );

                expect(references).to.be.empty;
                expect(receiverTokens).to.be.empty;
                expect(callbacks.errors).to.be.empty;
            });
        });

        describe("passage-typed macro arguments", () => {
            // References from parsing a passage with the built-in macros,
            // after a `:: Passage` header line, without the macro's own reference
            const referencesFor = (passage: string) => {
                const header = ":: Passage\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    uri: "fake-uri",
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);
                parser?.parsePassageText(passage, header.length, state);
                return callbacks.references.filter(
                    (r) =>
                        r.kind !== OSugarCubeSymbolKind.KnownMacro &&
                        r.kind !== OSugarCubeSymbolKind.UnknownMacro,
                );
            };

            it("should capture a variable reference and no passage reference for a story variable", () => {
                const references = referencesFor("<<goto $q>>");

                expect(references).to.eql([
                    {
                        contents: "$q",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 7, 1, 9),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture a variable reference and no passage reference for a temporary variable", () => {
                const references = referencesFor("<<goto _q>>");

                expect(references).to.eql([
                    {
                        contents: "_q",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 7, 1, 9),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });

            it("should capture variable and property references for a variable's property", () => {
                const references = referencesFor("<<goto $q.next>>");

                expect(references).to.eql([
                    {
                        contents: "$q",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 7, 1, 9),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                    {
                        contents: "$q.next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 10, 1, 14),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                    },
                ]);
            });

            it("should capture a setup property reference and no passage reference for a setup access", () => {
                const references = referencesFor("<<goto setup.next>>");

                expect(references).to.eql([
                    {
                        contents: "setup.next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 13, 1, 17),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                    },
                ]);
            });

            it("should capture a setting reference and no passage reference for a settings access", () => {
                const references = referencesFor("<<goto settings.next>>");

                expect(references).to.eql([
                    {
                        contents: "settings.next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 16, 1, 20),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                    },
                ]);
            });

            it("should produce variable and property semantic tokens for a variable's property", () => {
                const header = ":: Passage\n";
                const passage = "<<goto $q.next>>";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.tokens;

                // Slice to get rid of the token for the macro name
                expect(result.slice(1)).to.eql([
                    {
                        line: 1,
                        char: 7,
                        length: 2,
                        tokenType: ETokenType.variable,
                        tokenModifiers: [],
                    },
                    {
                        line: 1,
                        char: 10,
                        length: 4,
                        tokenType: ETokenType.property,
                        tokenModifiers: [],
                    },
                ]);
            });

            for (const passage of [
                '<<link "x" $q>><</link>>',
                '<<button "x" $q>><</button>>',
            ]) {
                it(`should capture a variable reference and no passage reference for a variable in ${passage}`, () => {
                    const start = passage.indexOf("$q");

                    const references = referencesFor(passage);

                    expect(references).to.eql([
                        {
                            contents: "$q",
                            location: Location.create(
                                "fake-uri",
                                Range.create(1, start, 1, start + 2),
                            ),
                            kind: OSugarCubeSymbolKind.Variable,
                        },
                    ]);
                });
            }

            for (const macro of ["goto", "include"]) {
                it(`should capture a variable reference inside the back-ticks and no passage reference for a back-ticked expression in <<${macro}>>`, () => {
                    const references = referencesFor(`<<${macro} \`$q\`>>`);
                    const start = macro.length + 4; // "<<", macro, " `"

                    expect(references).to.eql([
                        {
                            contents: "$q",
                            location: Location.create(
                                "fake-uri",
                                Range.create(1, start, 1, start + 2),
                            ),
                            kind: OSugarCubeSymbolKind.Variable,
                        },
                    ]);
                });
            }

            for (const passage of [
                '<<link "x" `$q`>><</link>>',
                '<<button "x" `$q`>><</button>>',
                "<<actions `$q`>>",
            ]) {
                it(`should capture a variable reference for a back-ticked passage expression in ${passage}`, () => {
                    const start = passage.indexOf("$q");

                    const references = referencesFor(passage);

                    expect(references).to.eql([
                        {
                            contents: "$q",
                            location: Location.create(
                                "fake-uri",
                                Range.create(1, start, 1, start + 2),
                            ),
                            kind: OSugarCubeSymbolKind.Variable,
                        },
                    ]);
                });
            }

            it("should capture a setup property reference for a back-ticked setup access", () => {
                const references = referencesFor("<<goto `setup.next`>>");

                expect(references).to.eql([
                    {
                        contents: "setup.next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 14, 1, 18),
                        ),
                        kind: OSugarCubeSymbolKind.Property,
                    },
                ]);
            });

            it("should error on a too-new Setting call in a back-ticked passage expression", () => {
                const header = ":: Passage\n";
                const passage = '<<goto `Setting.getValue("p")`>>';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.36.1",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const errors = callbacks.errors;

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].range).to.eql(Range.create(1, 16, 1, 24));
            });

            it("should capture a passage reference for a string passage name", () => {
                const references = referencesFor('<<goto "Next">>');

                expect(references).to.eql([
                    {
                        contents: "Next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 8, 1, 12),
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should capture a passage reference for a bareword passage name", () => {
                const references = referencesFor("<<goto Next>>");

                expect(references).to.eql([
                    {
                        contents: "Next",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 7, 1, 11),
                        ),
                        kind: TwineSymbolKind.Passage,
                    },
                ]);
            });

            it("should capture only a variable reference for a variable link target", () => {
                const references = referencesFor("<<link [[x|$q]]>><</link>>");

                expect(references).to.eql([
                    {
                        contents: "$q",
                        location: Location.create(
                            "fake-uri",
                            Range.create(1, 11, 1, 13),
                        ),
                        kind: OSugarCubeSymbolKind.Variable,
                    },
                ]);
            });
        });
    });

    describe("TwineScript statements", () => {
        // References (without macro references) and errors from parsing a
        // passage after a `:: Passage` header line
        const parse = (passage: string, formatVersion?: string) => {
            const header = ":: Passage\n";
            const callbacks = new MockCallbacks();
            const state = buildParsingState({
                uri: "fake-uri",
                content: header + passage,
                callbacks: callbacks,
            });
            if (formatVersion !== undefined) {
                state.storyFormat = { format: "SugarCube", formatVersion };
            }
            const parser = uut.getSugarCubeParser(undefined);
            parser?.parsePassageText(passage, header.length, state);
            return {
                references: callbacks.references.filter(
                    (r) =>
                        r.kind !== OSugarCubeSymbolKind.KnownMacro &&
                        r.kind !== OSugarCubeSymbolKind.UnknownMacro,
                ),
                errors: callbacks.errors,
                tokens: callbacks.tokens,
            };
        };

        it("should index and diagnose every statement in a <<set>> macro", () => {
            const { references, errors } = parse(
                '<<set $a to "x"; $b to Setting.getValue("v")>>',
                "2.36.1",
            );

            expect(
                references
                    .filter((r) => r.kind === OSugarCubeSymbolKind.VariableSet)
                    .map((r) => r.contents),
            ).to.eql(["$a", "$b"]);
            expect(errors.length).to.equal(1);
            expect(errors[0].code).to.equal("api-not-available");
            expect(errors[0].severity).to.eql(DiagnosticSeverity.Error);
            expect(errors[0].range).to.eql(Range.create(1, 31, 1, 39));
        });

        it("should index every statement in a <<run>> macro", () => {
            const { references } = parse("<<run $a.push(1); $b.push(2)>>");

            expect(references.map((r) => r.contents)).to.have.members([
                "$a",
                "$a.push",
                "$b",
                "$b.push",
            ]);
        });

        for (const passage of [
            "<<if $a; $b>>x<</if>>",
            "<<if 0>><<elseif $a; $b>>x<</if>>",
            "<<print $a; $b>>",
            "<<= $a; $b>>",
            "<<- $a; $b>>",
            "<<switch $a; $b>><</switch>>",
        ]) {
            it(`should read every statement in ${passage}`, () => {
                const { references, errors } = parse(passage);

                expect(references.map((r) => [r.contents, r.kind])).to.eql([
                    ["$a", OSugarCubeSymbolKind.Variable],
                    ["$b", OSugarCubeSymbolKind.Variable],
                ]);
                expect(errors).to.be.empty;
            });
        }

        for (const passage of [
            "[[go|P][$a to 1; $b to 2]]",
            "[img[pic.png][P][$a to 1; $b to 2]]",
            '<a data-setter="$a to 1; $b to 2">x</a>',
        ]) {
            it(`should assign every statement in ${passage}`, () => {
                const { references, errors } = parse(passage);

                expect(
                    references
                        .filter(
                            (r) => r.kind === OSugarCubeSymbolKind.VariableSet,
                        )
                        .map((r) => r.contents),
                ).to.eql(["$a", "$b"]);
                expect(errors).to.be.empty;
            });
        }

        it("should index a variable image source", () => {
            const { references } = parse("[img[$src][P][$a to 1]]");

            expect(
                references.map((r) => [r.contents, r.location.range]),
            ).to.have.deep.members([
                ["$src", Range.create(1, 5, 1, 9)],
                ["P", Range.create(1, 11, 1, 12)],
                ["$a", Range.create(1, 14, 1, 16)],
            ]);
        });

        for (const passage of [
            "<<link `$a; $b`>><</link>>",
            '<<textbox `$a; $b` "">>',
            "<<cycle '_c'>><<option `$a; $b`>><</cycle>>",
            "<<unknownmacro `$a; $b`>>",
        ]) {
            it(`should index every statement in a back-ticked argument in ${passage}`, () => {
                const { references } = parse(passage);

                expect(references.map((r) => r.contents)).to.include("$b");
            });
        }

        it("should report a syntax error that starts at text after a complete statement", () => {
            const { errors } = parse("<<set $a to 1 $b>>");

            expect(errors.length).to.equal(1);
            expect(errors[0].severity).to.eql(DiagnosticSeverity.Error);
            expect(errors[0].range.start).to.eql({ line: 1, character: 14 });
        });

        it("should not report an error for a trailing semicolon", () => {
            const { errors } = parse("<<set $a to 1;>>");

            expect(errors).to.be.empty;
        });

        it("should report a syntax error for code that starts with an object literal", () => {
            const { errors } = parse("<<print {a: 1, b: 2}>>");

            expect(errors.length).to.equal(1);
            expect(errors[0].severity).to.eql(DiagnosticSeverity.Error);
        });

        it("should not report an error for an object literal <<for>> range collection", () => {
            const { errors } = parse(
                "<<for _k, _v range {a: 1, b: 2}>><</for>>",
            );

            expect(errors).to.be.empty;
        });

        it("should index every statement in a <<for>> range collection", () => {
            const { references, errors } = parse(
                "<<for _v range $a; $b>><</for>>",
            );

            expect(references.map((r) => r.contents)).to.eql([
                "_v",
                "$a",
                "$b",
            ]);
            expect(errors).to.be.empty;
        });

        it("should report text after the expression in an expression-only site as a syntax error", () => {
            const { errors } = parse("<<for _v range {a: 1} $b + 1 >><</for>>");

            expect(errors.length).to.equal(1);
            expect(errors[0].severity).to.eql(DiagnosticSeverity.Error);
            expect(errors[0].range).to.eql(Range.create(1, 22, 1, 28));
        });

        it("should locate references, semantic tokens and diagnostics on both sides of a semicolon", () => {
            const { references, errors, tokens } = parse(
                '<<set $x to $y and $z; $w to Setting.getValue("v")>>',
                "2.36.1",
            );

            expect(
                references.map((r) => [r.contents, r.location.range]),
            ).to.eql([
                ["$x", Range.create(1, 6, 1, 8)],
                ["$y", Range.create(1, 12, 1, 14)],
                ["$z", Range.create(1, 19, 1, 21)],
                ["$w", Range.create(1, 23, 1, 25)],
            ]);
            expect(
                tokens
                    .filter((t) => t.line === 1 && t.char >= 15)
                    .map((t) => [t.char, t.length, t.tokenType]),
            ).to.include.deep.members([
                [15, 3, ETokenType.operator], // and
                [19, 2, ETokenType.variable], // $z
                [23, 2, ETokenType.variable], // $w
                [26, 2, ETokenType.operator], // to
            ]);
            expect(errors.length).to.equal(1);
            expect(errors[0].code).to.equal("api-not-available");
            expect(errors[0].range).to.eql(Range.create(1, 37, 1, 45));
        });

        it("should keep an assignment in a <<print>> macro a read", () => {
            const { references } = parse("<<print $x = 1>>");

            expect(references.map((r) => [r.contents, r.kind])).to.eql([
                ["$x", OSugarCubeSymbolKind.Variable],
            ]);
        });

        it("should parse a TwineScript <<script>> body as statements", () => {
            const { references, errors } = parse(
                "<<script TwineScript>>$a.push(1); $b.push(2)<</script>>",
            );

            expect(references.map((r) => r.contents)).to.have.members([
                "$a",
                "$a.push",
                "$b",
                "$b.push",
            ]);
            expect(errors).to.be.empty;
        });

        for (const passage of [
            "<<unset $a $b>>",
            "<<unset $a; $b>>",
            "<<unset $a, $b>>",
            "<<unset $a ,; _b>>",
        ]) {
            it(`should index every variable in ${passage}`, () => {
                const { references, errors } = parse(passage);
                const b = passage.endsWith("_b>>") ? "_b" : "$b";

                expect(references.map((r) => r.contents)).to.eql(["$a", b]);
                expect(references[1].location.range.start.character).to.equal(
                    passage.indexOf(b),
                );
                expect(errors).to.be.empty;
            });
        }
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
            const macro = buildMacroInfo({
                name: "testy",
            });
            const parser = uut.getSugarCubeParser(undefined, {
                allMacros: () => {
                    return { testy: macro };
                },
                allMacroEnums: () => {
                    return {};
                },
            });

            parser?.parsePassageText(passage, header.length, state);
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
                        Range.create(2, 39, 2, 51),
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
                        Range.create(2, 39, 2, 45),
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
                        Range.create(2, 43, 2, 55),
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
                        Range.create(2, 46, 2, 58),
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
                        Range.create(2, 43, 2, 55),
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
                        Range.create(2, 42, 2, 54),
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
                        Range.create(2, 43, 2, 55),
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
                        Range.create(2, 44, 2, 56),
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
                        Range.create(2, 43, 2, 55),
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
                        Range.create(2, 38, 2, 44),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 42, 2, 48),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 45, 2, 51),
                    ),
                    kind: OSugarCubeSymbolKind.VariableSet,
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
                        Range.create(2, 49, 2, 52),
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
                        Range.create(2, 42, 2, 45),
                    ),
                    kind: OSugarCubeSymbolKind.Variable,
                },
            ]);
        });

        it("should not capture a variable reference in a plain attribute", () => {
            const header = ":: Passage\n";
            const passage =
                "Some content.\n" + `<span id="'pre-' + _id + '-suf'">.\n`;
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
                "p {\n  color: #26b72b;\n}",
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
                    "StoryDisplayTitle isn't supported in SugarCube version 2.30.0",
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
                    "StoryInterface isn't supported in SugarCube version 2.17.0",
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
                    "StoryShare is deprecated as of SugarCube version 2.37.0",
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
                            Range.create(0, 12, 0, 23),
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
                    "Twine.audio isn't supported in SugarCube version 2.23.0",
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
                            Range.create(0, 12, 0, 23),
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
                    "Twine.video isn't supported in SugarCube version 2.23.0",
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
                            Range.create(0, 12, 0, 23),
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
                    "Twine.vtt isn't supported in SugarCube version 2.23.0",
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
                            Range.create(0, 12, 0, 23),
                        ),
                    },
                    {
                        contents: "Twine.audio",
                        location: Location.create(
                            "fake-uri",
                            Range.create(0, 25, 0, 31),
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
                    "Multiple media passage tags aren't allowed",
                );
                expect(result[0].range).to.eql(Range.create(0, 12, 0, 23));
                expect(result[1].severity).to.eql(DiagnosticSeverity.Error);
                expect(result[1].message).to.include(
                    "Multiple media passage tags aren't allowed",
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
                            Range.create(0, 12, 0, 23),
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
                    "bookmark is deprecated as of SugarCube version 2.37.0",
                );
                expect(result.range).to.eql(Range.create(0, 12, 0, 23));
            });
        });

        describe("variables", () => {
            it("should warn on the variable $args used outside of a <<widget>> macro", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: $args\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "$args typically only exists inside <<widget>>",
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 15));
            });

            it("should warn on the variable _args used outside of a <<widget>> macro", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: _args\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "_args typically only exists inside <<widget>>",
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 15));
            });

            it("should warn on the variable _contents used outside of a <<widget>> macro", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: _contents\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "_contents typically only exists inside <<widget>>",
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 19));
            });

            it("should not warn on the variable _args used inside of a <<widget>> macro", () => {
                const header = ":: Passage [widget]\n";
                // Test _args both in child macros and as a bare variable
                const passage =
                    'Let\'s go: <<widget "name">><<if _args>>_args<</if>><</widget>>\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.errors;

                expect(result).to.be.empty;
            });

            it("should not warn on the variable _args used inside of an unclosed <<widget>> macro", () => {
                const header = ":: Passage [widget]\n";
                // Test _args both in child macros and as a bare variable
                const passage =
                    'Let\'s go: <<widget "name">><<if _args>>_args<</if>>\n';
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
                    "Closing macro <</widget>> not found",
                );
            });

            it("should not warn on the variable State.variables.args used inside of a <<script>> inside a <<widget>> macro", () => {
                const header = ":: Passage [widget]\n";
                // Test _args both in child macros and as a bare variable
                const passage =
                    'Let\'s go: <<widget "name">><<script>>const v = State.variables.args[0];<</script>><</widget>>\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const result = callbacks.errors;

                expect(result).to.be.empty;
            });
        });

        describe("Setting methods newer than the format version in JavaScript", () => {
            it("should error on a too-new Setting call in a script passage", () => {
                const header = ":: Passage [script]\n";
                const passage = 'Setting.addValue("x", 1);\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.36.1",
                };
                state.currentPassage = buildPassage({
                    label: "Passage",
                    isScript: true,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.code).to.equal("api-not-available");
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.equal(
                    "`Setting.addValue` isn't available until SugarCube version 2.37.0 but your StoryFormat version is 2.36.1",
                );
                expect(result.range).to.eql(Range.create(1, 8, 1, 16));
            });

            it("should error on a too-new Setting call in a <<script>> block", () => {
                const header = ":: Passage\n";
                const passage = '<<script>>Setting.getValue("x");<</script>>\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.storyFormat = {
                    format: "SugarCube",
                    formatVersion: "2.36.1",
                };
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.code).to.equal("api-not-available");
                expect(result.range).to.eql(Range.create(1, 18, 1, 26));
            });

            it("should not error on a Setting call without a format version", () => {
                const header = ":: Passage [script]\n";
                const passage = 'Setting.addValue("x", 1);\n';
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                state.currentPassage = buildPassage({
                    label: "Passage",
                    isScript: true,
                });
                const parser = uut.getSugarCubeParser(undefined);

                parser?.parsePassageText(passage, header.length, state);

                expect(callbacks.errors).to.eql([]);
            });
        });

        describe("Setting methods newer than the format version in TwineScript", () => {
            // Errors from parsing a passage, after a `:: Passage` header line
            const errorsFor = (passage: string, formatVersion?: string) => {
                const header = ":: Passage\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                if (formatVersion !== undefined) {
                    state.storyFormat = { format: "SugarCube", formatVersion };
                }
                const parser = uut.getSugarCubeParser(undefined);
                parser?.parsePassageText(passage, header.length, state);
                return callbacks.errors;
            };

            it("should error on a too-new Setting call in a <<run>> macro", () => {
                const errors = errorsFor(
                    '<<run Setting.setValue("muted", true)>>\n',
                    "2.36.1",
                );

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].severity).to.eql(DiagnosticSeverity.Error);
                expect(errors[0].message).to.equal(
                    "`Setting.setValue` isn't available until SugarCube version 2.37.0 but your StoryFormat version is 2.36.1",
                );
                expect(errors[0].range).to.eql(Range.create(1, 14, 1, 22));
            });

            it("should locate a too-new Setting call after desugared text in the passage text", () => {
                const errors = errorsFor(
                    '<<set $x to $y and Setting.getValue("volume")>>\n',
                    "2.36.1",
                );

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].range).to.eql(Range.create(1, 27, 1, 35));
            });

            it("should error on a too-new window.SugarCube.Setting call", () => {
                const errors = errorsFor(
                    '<<run window.SugarCube.Setting.setValue("muted", true)>>\n',
                    "2.36.1",
                );

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].range).to.eql(Range.create(1, 31, 1, 39));
            });

            it("should not error on a too-new call through a local binding that shadows Setting", () => {
                const errors = errorsFor(
                    '<<run ((Setting) => Setting.setValue("muted", true))(_s)>>\n',
                    "2.36.1",
                );

                expect(errors).to.eql([]);
            });

            it("should error on a too-new Setting call in a <<set>> to a temporary variable", () => {
                const errors = errorsFor(
                    '<<set _v to Setting.getValue("volume")>>\n',
                    "2.36.1",
                );

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].range).to.eql(Range.create(1, 20, 1, 28));
            });

            it("should error on a too-new SugarCube.Setting call", () => {
                const errors = errorsFor(
                    '<<set _v to SugarCube.Setting.getValue("volume")>>\n',
                    "2.36.1",
                );

                expect(errors.length).to.equal(1);
                expect(errors[0].code).to.equal("api-not-available");
                expect(errors[0].range).to.eql(Range.create(1, 30, 1, 38));
            });

            it("should not error on a bare read of a too-new Setting method", () => {
                const errors = errorsFor(
                    "<<if Setting.addValue>>yes<</if>>\n",
                    "2.36.1",
                );

                expect(errors).to.eql([]);
            });

            it("should not error on an optional call of a too-new Setting method", () => {
                const errors = errorsFor(
                    '<<run Setting.addValue?.("x", 1)>>\n',
                    "2.36.1",
                );

                expect(errors).to.eql([]);
            });

            it("should not error on a Setting call at the version it was added in", () => {
                const errors = errorsFor(
                    '<<run Setting.setValue("muted", true)>>\n',
                    "2.37.0",
                );

                expect(errors).to.eql([]);
            });

            it("should not error on a Setting call without a format version", () => {
                const errors = errorsFor(
                    '<<run Setting.setValue("muted", true)>>\n',
                );

                expect(errors).to.eql([]);
            });

            it("should not error on a Setting call with an unparseable format version", () => {
                const errors = errorsFor(
                    '<<run Setting.setValue("muted", true)>>\n',
                    "not-a-version",
                );

                expect(errors).to.eql([]);
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
                const macro = buildMacroInfo({
                    name: "testy",
                });
                macro.since = "2.1.1";
                const parser = uut.getSugarCubeParser("2.1", {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "`testy` isn't available until SugarCube version 2.1.1 but your StoryFormat version is 2.1",
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
                const macro = buildMacroInfo({
                    name: "testy",
                });
                macro.removed = "2.1";
                const parser = uut.getSugarCubeParser("2.1", {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "`testy` was removed in SugarCube version 2.1 and your StoryFormat version is 2.1",
                );
                expect(result.range).to.eql(Range.create(1, 10, 1, 19));
            });

            it("should error on a macro inside a link setter", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: [[passage][<<testy>>]]\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfo({
                    name: "testy",
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "Macros aren't evaluated inside link setters",
                );
                expect(result.range).to.eql(Range.create(1, 21, 1, 30));
            });

            it("should error on a closing macro that isn't a container", () => {
                const header = ":: Passage\n";
                const passage = "Let's go: <</testy>>\n";
                const callbacks = new MockCallbacks();
                const state = buildParsingState({
                    content: header + passage,
                    callbacks: callbacks,
                });
                const macro = buildMacroInfo({
                    name: "testy",
                    container: false,
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "<<testy>> macro isn't a container and so doesn't have a closing macro",
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
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Closing macro <</testy>> not found",
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
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                expect(result.message).to.include(
                    "<<endtesty>> is deprecated; use <</testy>> instead",
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
                const macro = buildMacroInfo({
                    name: "testy",
                    container: true,
                });
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { testy: macro };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Opening macro <<testy>> not found",
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
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 2 }];
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macroA, b: macroB };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
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
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 2 }];
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macroA, b: macroB };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
                const [result] = callbacks.errors;

                expect(callbacks.errors.length).to.equal(1);
                expect(result.severity).to.eql(DiagnosticSeverity.Error);
                expect(result.message).to.include(
                    "Child macro <<b>> can be used at most 2 times",
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
                const macroA = buildMacroInfo({
                    name: "a",
                    container: true,
                });
                const macroB = buildMacroInfo({ name: "b" });
                macroB.parents = [{ name: "a", max: 1 }];
                const parser = uut.getSugarCubeParser(undefined, {
                    allMacros: () => {
                        return { a: macroA, b: macroB };
                    },
                    allMacroEnums: () => {
                        return {};
                    },
                });

                parser?.parsePassageText(passage, header.length, state);
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
                        "Unable to parse macro argument: unterminated single quoted string",
                    );
                    expect(result.range).to.eql(Range.create(1, 14, 1, 27));
                });

                it("should not error on an array argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a [1, 2, 3]>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.errors;

                    expect(result).to.be.empty;
                });

                it("should not error on an object argument", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a {1: 2, 3: 4}>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const parser = uut.getSugarCubeParser(undefined);

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.errors;

                    expect(result).to.be.empty;
                });

                it("should raise a warning for no arguments to a macro that expects them", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = true;
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
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
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = false;
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
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
                    const macro = buildMacroInfo({ name: "a" });
                    macro.arguments = undefined;
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const result = callbacks.errors;

                    expect(result).to.be.empty;
                });

                it("should not error on link values", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Let's go: <<a [[Passage Name<-Display text][$testy to 7]]>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["link"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const results = callbacks.errors;

                    expect(results).to.be.empty;
                });

                it("should raise an error for a non-boolean argument to a macro that takes a boolean", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a 1>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["boolean"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Error);
                    expect(result.message).to.include(
                        "Argument is not a boolean",
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
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        container: true,
                        args: ["number"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
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
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        container: true,
                        args: ["number"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Closing macros don't take arguments",
                    );
                    expect(result.range).to.eql(Range.create(1, 22, 1, 28));
                });

                it("should warn on a receiver value that's not a string", () => {
                    const header = ":: Passage\n";
                    const passage = "Let's go: <<a bare $testy>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["bareword &+ receiver"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Do you mean for this receiver value to be a bare variable?",
                    );
                    expect(result.range).to.eql(Range.create(1, 19, 1, 25));
                });

                it("should not error on link values", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Let's go: <<a [[Passage Name<-Display text][$testy to 7]]>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["link"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const results = callbacks.errors;

                    expect(results).to.be.empty;
                });

                it("should warn on linkNoSetter values with a setter", () => {
                    const header = ":: Passage\n";
                    const passage =
                        "Let's go: <<a [[Passage Name<-Display text][$testy to 7]]>>\n";
                    const callbacks = new MockCallbacks();
                    const state = buildParsingState({
                        content: header + passage,
                        callbacks: callbacks,
                    });
                    const macro = buildMacroInfoWithArgs({
                        name: "a",
                        args: ["linkNoSetter"],
                    });
                    const parser = uut.getSugarCubeParser(undefined, {
                        allMacros: () => {
                            return { a: macro };
                        },
                        allMacroEnums: () => {
                            return {};
                        },
                    });

                    parser?.parsePassageText(passage, header.length, state);
                    const [result] = callbacks.errors;

                    expect(callbacks.errors.length).to.equal(1);
                    expect(result.severity).to.eql(DiagnosticSeverity.Warning);
                    expect(result.message).to.include(
                        "Argument is a link, but does not allow setter syntax",
                    );
                    expect(result.range).to.eql(Range.create(1, 14, 1, 57));
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
                    `Both "data-passage" and "href" attributes aren't allowed`,
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
                    `"data-setter" can't have an evaluation directive`,
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
                    `"data-setter" can't have an evaluation directive`,
                );
                expect(result.range).to.eql(Range.create(2, 20, 2, 28));
            });
        });
    });
});
