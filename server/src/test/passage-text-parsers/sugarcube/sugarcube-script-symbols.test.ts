import "mocha";
import { expect } from "chai";

import { buildParsingState, MockCallbacks } from "../../builders";
import { tokenizeJavaScript } from "../../../js-parser";
import * as uut from "../../../passage-text-parsers/sugarcube/sugarcube-script-symbols";

function extract(text: string) {
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
            extractScriptSymbols: uut.extractSugarCubeScriptSymbols,
        },
    );
    return {
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
    });

    it("should ignore bare names, declarations, UMD names and shadowed roots", () => {
        const result = extract(
            "var $x = 1; $x; Config.a; module.exports = define(self, global); function State() {} State.variables.q;",
        );

        expect(result.vars).to.eql([]);
    });
});
