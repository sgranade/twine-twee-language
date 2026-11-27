import "mocha";
import { expect } from "chai";

import { buildParsingState, MockCallbacks } from "../../builders";
import { tokenizeJavaScript } from "../../../js-parser";
import * as uut from "../../../passage-text-parsers/sugarcube/sugarcube-script-symbols";

const extractWithoutVersion = uut.createSugarCubeScriptExtractor();

function extract(
    text: string,
    { formatVersion }: { formatVersion?: string } = {},
) {
    const state = buildParsingState({
        uri: "fake-uri",
        content: text,
        callbacks: new MockCallbacks(),
    });
    const result = tokenizeJavaScript(
        true,
        text,
        0,
        state.textDocument,
        { passageTokens: {} },
        {
            isAssignmentContext: true,
            extractScriptSymbols: uut.createSugarCubeScriptExtractor({
                formatVersion,
            }),
        },
    );
    return {
        // Diagnostics as [code, located text, message]
        diagnostics: (result.diagnostics ?? []).map((d) => [
            d.code,
            text.slice(d.start, d.end),
            d.message,
        ]),
        vars: result.variables.map((v) => [
            v.contents,
            text.slice(
                state.textDocument.offsetAt(v.location.range.start),
                state.textDocument.offsetAt(v.location.range.end),
            ),
            !!v.assigned,
            !!v.sigilOutsideRange,
        ]),
        props: result.properties.map((p) => [p.prefix, p.contents]),
        // Properties as [prefix, contents, assigned, located text]
        located: result.properties.map((p) => [
            p.prefix,
            p.contents,
            !!p.assigned,
            text.slice(
                state.textDocument.offsetAt(p.location.range.start),
                state.textDocument.offsetAt(p.location.range.end),
            ),
        ]),
        opaque: [
            ...result.variables.filter((v) => v.opaque).map((v) => v.contents),
            ...result.properties
                .filter((p) => p.opaque)
                .map((p) => `${p.prefix}.${p.contents}`),
        ],
    };
}

describe("SugarCube Script Symbols", () => {
    for (const root of [
        "State.variables",
        "SugarCube.State.variables",
        "window.SugarCube.State.variables",
        "variables()",
    ]) {
        it(`should read a variable through ${root}`, () => {
            const result = extract(`${root}.gold;`);

            expect(result.vars).to.eql([["$gold", "gold", false, true]]);
        });
    }

    it("should map State.temporary to the _ sigil and mark assignments", () => {
        const result = extract("State.temporary.x = 1;");

        expect(result.vars).to.eql([["_x", "x", true, true]]);
    });

    it("should index getVar/setVar string and template keys only", () => {
        const result = extract(
            "State.getVar('$gold'); State.setVar(`_hp`, 1); State.getVar('gold'); State.getVar(`$${k}`);",
        );

        expect(result.vars).to.eql([
            ["$gold", "gold", false, true],
            ["_hp", "hp", true, true],
        ]);
    });

    it("should follow a single-initializer alias but not a reassigned or non-root one", () => {
        expect(
            extract("const v = State.variables; v.gold;").vars.map((v) => v[0]),
        ).to.eql(["$gold"]);
        expect(extract("let v = State.variables; v = {}; v.gold;").vars).to.eql(
            [],
        );
        expect(extract("const v = State.variables.a; v.gold;").vars).to.eql([
            ["$a", "a", false, true],
        ]);
        expect(extract("const v = foo(State); v.gold;").vars).to.eql([]);
    });

    it("should index destructured reads", () => {
        const result = extract("const { gold, hp: h } = State.variables;");

        expect(result.vars.map((v) => [v[0], v[1], v[2]])).to.eql([
            ["$gold", "gold", false],
            ["$hp", "hp", false],
        ]);
    });

    it("should index string-keyed access (including accented symbols) but not escaped spellings or non-identifiers", () => {
        expect(extract("State.variables['gold'];").vars).to.eql([
            ["$gold", "gold", false, true],
        ]);
        expect(extract("State.variables['café'];").vars).to.eql([
            ["$café", "café", false, true],
        ]);
        expect(extract("State.variables['\\x66oo'];").vars).to.eql([]);
        expect(extract("State.variables['a b'];").vars).to.eql([]);
    });

    it("should capture properties of a state variable", () => {
        const result = extract("State.variables.a.b.c = 1;");

        expect(result.props).to.eql([
            ["$a", "b"],
            ["$a.b", "c"],
        ]);
    });

    describe("Opaque Assignments", () => {
        it("should mark a state-root write of a call's result opaque", () => {
            expect(
                extract("State.variables.x = fn(); State.temporary.y = fn();")
                    .opaque,
            ).to.eql(["$x", "_y"]);
        });

        for (const root of [
            "variables()",
            "SugarCube.State.variables",
            "window.SugarCube.State.variables",
        ]) {
            it(`should mark a write through ${root} as opaque`, () => {
                expect(extract(`${root}.x = fn();`).opaque).to.eql(["$x"]);
            });
        }

        it("should mark a write through an aliased state root as opaque", () => {
            expect(
                extract("const v = State.variables; v.x = fn();").opaque,
            ).to.eql(["$x"]);
        });

        it("should mark a property-path write as opaque at the property, not the variable", () => {
            expect(extract("State.variables.a.b = fn();").opaque).to.eql([
                "$a.b",
            ]);
        });

        it("should judge setVar's opaqueness by its value argument", () => {
            expect(
                extract("State.setVar('$x', fn()); State.setVar('$y', 5);")
                    .opaque,
            ).to.eql(["$x"]);
        });

        it("should ignore a self-reference through any state root", () => {
            expect(
                extract(
                    "variables().inv = variables().inv || {};" +
                        "const v = State.variables; v.bag = State.variables.bag || {};" +
                        "State.setVar('$pack', State.getVar('$pack') ?? {});",
                ).opaque,
            ).to.eql([]);
        });

        it("should record copies of story state through any state root as shape sources", () => {
            const text =
                "State.variables.p = variables().player;" +
                "State.setVar('_q', State.getVar('$player').stats);" +
                "State.variables.a.b = clone(State.temporary.c);";
            const state = buildParsingState({
                uri: "fake-uri",
                content: text,
                callbacks: new MockCallbacks(),
            });
            const result = tokenizeJavaScript(
                true,
                text,
                0,
                state.textDocument,
                { passageTokens: {} },
                {
                    isAssignmentContext: true,
                    extractScriptSymbols: extractWithoutVersion,
                },
            );

            expect(
                [...result.variables, ...result.properties]
                    .filter((l) => l.shapeSources)
                    .map((l) => [l.contents, l.shapeSources]),
            ).to.eql([
                ["$p", ["$player"]],
                ["_q", ["$player.stats"]],
                ["b", ["_c"]],
            ]);
        });
    });

    it("should ignore bare names, declarations, UMD names and shadowed roots", () => {
        const result = extract(
            "var $x = 1; $x; Config.a; module.exports = define(self, global); function State() {} State.variables.q;",
        );

        expect(result.vars).to.eql([]);
    });

    describe("setup Object Properties", () => {
        it("should capture setup properties through setup and SugarCube.setup but not window.setup", () => {
            expect(
                extract(
                    "setup.a = 1; SugarCube.setup.b; window.SugarCube.setup.c.d; window.setup.e;",
                ).props,
            ).to.eql([
                ["setup", "a"],
                ["setup", "b"],
                ["setup", "c"],
                ["setup.c", "d"],
            ]);
        });

        it("should capture writes through SugarCube.setup and window.SugarCube.setup", () => {
            const text = "SugarCube.setup.a = 1; window.SugarCube.setup.b = 1;";
            const state = buildParsingState({
                uri: "fake-uri",
                content: text,
                callbacks: new MockCallbacks(),
            });
            const result = tokenizeJavaScript(
                true,
                text,
                0,
                state.textDocument,
                { passageTokens: {} },
                {
                    isAssignmentContext: true,
                    extractScriptSymbols: extractWithoutVersion,
                },
            );

            expect(
                result.properties.map((p) => [
                    `${p.prefix}.${p.contents}`,
                    !!p.assigned,
                ]),
            ).to.eql([
                ["setup.a", true],
                ["setup.b", true],
            ]);
        });

        it("should capture destructured reads of setup", () => {
            expect(
                extract("const { a, b: c } = setup; ({ d } = SugarCube.setup);")
                    .props,
            ).to.eql([
                ["setup", "a"],
                ["setup", "b"],
                ["setup", "d"],
            ]);
        });

        it("should ignore a local binding named setup", () => {
            expect(extract("function f(setup) { setup.a = 1; }").props).to.eql(
                [],
            );
        });

        it("should follow a never-reassigned alias of setup but not a reassigned one", () => {
            expect(extract("const s = setup; s.a = 1;").props).to.eql([
                ["setup", "a"],
            ]);
            expect(extract("let s = setup; s = {}; s.a = 1;").props).to.eql([]);
        });
    });

    describe("Setting Object", () => {
        it("should capture a Setting.addToggle literal name as a write of the setting", () => {
            const text = 'Setting.addToggle("music", { label: "Music" });';
            const result = extract(text).located;

            expect(result).to.eql([["settings", "music", true, "music"]]);
        });

        for (const method of ["addList", "addRange", "addValue"]) {
            it(`should capture a Setting.${method} literal name as a write`, () => {
                expect(
                    extract(`Setting.${method}('volume', {});`).located,
                ).to.eql([["settings", "volume", true, "volume"]]);
            });
        }

        it("should not capture a Setting.addHeader name", () => {
            expect(extract('Setting.addHeader("music");').located).to.eql([]);
        });

        it("should capture Setting calls through SugarCube and window.SugarCube", () => {
            expect(
                extract(
                    'SugarCube.Setting.addToggle("a", {}); window.SugarCube.Setting.addToggle("b", {});',
                ).props,
            ).to.eql([
                ["settings", "a"],
                ["settings", "b"],
            ]);
        });

        it("should ignore Setting calls on a local binding named Setting", () => {
            expect(
                extract('function f(Setting) { Setting.addToggle("a", {}); }')
                    .props,
            ).to.eql([]);
        });

        it("should ignore a Setting.addToggle with a non-literal name", () => {
            expect(extract("Setting.addToggle(key, {});").props).to.eql([]);
        });

        it("should capture Setting.getValue as a read and Setting.setValue as a write", () => {
            expect(
                extract(
                    'Setting.getValue("music"); Setting.setValue(`volume`, 3);',
                ).located,
            ).to.eql([
                ["settings", "music", false, "music"],
                ["settings", "volume", true, "volume"],
            ]);
        });

        it("should capture settings reads and writes through settings, SugarCube.settings and window.SugarCube.settings but not window.settings", () => {
            expect(
                extract(
                    "settings.a = true; SugarCube.settings.b; window.SugarCube.settings.c = 1; window.settings.d;",
                ).located,
            ).to.eql([
                ["settings", "a", true, "a"],
                ["settings", "b", false, "b"],
                ["settings", "c", true, "c"],
            ]);
        });

        it("should follow a never-reassigned alias of settings but not a reassigned one", () => {
            expect(extract("const s = settings; s.music;").props).to.eql([
                ["settings", "music"],
            ]);
            expect(extract("let s = settings; s = {}; s.music;").props).to.eql(
                [],
            );
        });

        it("should ignore a Setting call whose name isn't an identifier", () => {
            expect(extract('Setting.addToggle("music-on", {});').props).to.eql(
                [],
            );
        });

        it("should capture the keys of an object literal Setting.setValue writes", () => {
            expect(
                extract('Setting.setValue("audio", { volume: 3 });').located,
            ).to.eql([
                ["settings", "audio", true, "audio"],
                ["settings.audio", "volume", true, "volume"],
            ]);
        });
    });

    describe("Setting Methods Newer than the Format Version", () => {
        it("should report Setting.addValue before 2.37.0 on the method name", () => {
            expect(
                extract('Setting.addValue("x", 1);', {
                    formatVersion: "2.36.1",
                }).diagnostics,
            ).to.eql([
                [
                    "api-not-available",
                    "addValue",
                    "`Setting.addValue` isn't available until SugarCube version 2.37.0 but your StoryFormat version is 2.36.1",
                ],
            ]);
        });

        for (const [method, before, since] of [
            ["getValue", "2.36.1", "2.37.0"],
            ["setValue", "2.36.1", "2.37.0"],
            ["addRange", "2.25.0", "2.26.0"],
            ["addHeader", "2.7.0", "2.7.1"],
        ]) {
            it(`should report Setting.${method} at ${before} but not at ${since}`, () => {
                const text = `Setting.${method}("x", 1);`;

                expect(
                    extract(text, { formatVersion: before }).diagnostics,
                ).to.eql([
                    [
                        "api-not-available",
                        method,
                        `\`Setting.${method}\` isn't available until SugarCube version ${since} but your StoryFormat version is ${before}`,
                    ],
                ]);
                expect(
                    extract(text, { formatVersion: since }).diagnostics,
                ).to.eql([]);
            });
        }

        it("should never report Setting.addToggle or Setting.addList", () => {
            expect(
                extract(
                    'Setting.addToggle("a", {}); Setting.addList("b", {});',
                    {
                        formatVersion: "2.0.0",
                    },
                ).diagnostics,
            ).to.eql([]);
        });

        it("should report calls through SugarCube and window.SugarCube", () => {
            expect(
                extract(
                    'SugarCube.Setting.addValue("a", 1); window.SugarCube.Setting.addValue("b", 1);',
                    { formatVersion: "2.36.1" },
                ).diagnostics.map((d) => d[1]),
            ).to.eql(["addValue", "addValue"]);
        });

        it("should not report calls on a local binding named Setting", () => {
            expect(
                extract('function f(Setting) { Setting.addValue("a", 1); }', {
                    formatVersion: "2.36.1",
                }).diagnostics,
            ).to.eql([]);
        });

        it("should not report optional calls or member reads", () => {
            expect(
                extract(
                    'Setting.addValue?.("a", 1); if (Setting.addValue) {} const f = Setting.addValue;',
                    { formatVersion: "2.36.1" },
                ).diagnostics,
            ).to.eql([]);
        });

        it("should report calls whatever their arguments", () => {
            expect(
                extract(
                    'Setting.addValue(key, 1); Setting.addValue("music-on", 1);',
                    { formatVersion: "2.36.1" },
                ).diagnostics.map((d) => d[1]),
            ).to.eql(["addValue", "addValue"]);
        });

        it("should still index a setting a too-new call defines", () => {
            expect(
                extract('Setting.addValue("music", 1);', {
                    formatVersion: "2.36.1",
                }).located,
            ).to.eql([["settings", "music", true, "music"]]);
        });

        for (const formatVersion of [undefined, "two.thirty"]) {
            it(`should not report anything with a format version of ${formatVersion}`, () => {
                expect(
                    extract('Setting.addValue("a", 1);', { formatVersion })
                        .diagnostics,
                ).to.eql([]);
            });
        }
    });
});
