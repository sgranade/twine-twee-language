import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Location, Range } from "vscode-languageserver";

import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";

import * as uut from "../../../passage-text-parsers/sugarcube";

describe("SugarCube Parsing", () => {
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
