import "mocha";
import { expect } from "chai";
import { DiagnosticSeverity, Range } from "vscode-languageserver";

import { DiagnosticCode, DiagnosticCodes } from "@tt3/shared";
import { MockCallbacks, buildParsingState, buildPassage } from "../../builders";
import { chapbookLookupRoots } from "../../../passage-text-parsers/chapbook/chapbook-shadowing";
import { windowGlobals } from "../../../passage-text-parsers/chapbook/window-globals";

import * as uut from "../../../passage-text-parsers/chapbook";

function parseVars(
    varsSection: string,
    body = "",
    disabled?: Set<DiagnosticCode>,
): MockCallbacks {
    const header = ":: Passage\n";
    const passage = varsSection + "\n--\n" + body;
    const callbacks = new MockCallbacks();
    const state = buildParsingState({
        content: header + passage,
        callbacks: callbacks,
    });
    state.currentPassageDisabledDiagnostics = disabled;
    uut.getChapbookParser(undefined)?.parsePassageText(
        passage,
        header.length,
        state,
    );
    return callbacks;
}

function parseScript(script: string): MockCallbacks {
    const header = ":: Passage [script]\n";
    const callbacks = new MockCallbacks();
    const state = buildParsingState({
        content: header + script,
        callbacks: callbacks,
    });
    state.currentPassage = buildPassage({ isScript: true });
    uut.getChapbookParser(undefined)?.parsePassageText(
        script,
        header.length,
        state,
    );
    return callbacks;
}

describe("Chapbook shadowed variables", () => {
    it("should know the Chapbook lookup roots", () => {
        expect([...chapbookLookupRoots].sort()).to.eql([
            "browser",
            "engine",
            "now",
            "passage",
            "random",
            "story",
        ]);
    });

    it("should include JavaScript's own globals in the window globals", () => {
        expect(windowGlobals.has("Date")).to.be.true;
        expect(windowGlobals.has("location")).to.be.true;
    });

    describe("vars section", () => {
        it("should warn on a name that's a browser global", () => {
            const callbacks = parseVars("location: 'cave'");
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.code).to.equal(
                DiagnosticCodes.ChapbookVariableShadowedByBrowser,
            );
            expect(result.severity).to.equal(DiagnosticSeverity.Warning);
            expect(result.message).to.include("browser global");
            expect(result.message).to.include("Rename it");
            expect(result.range).to.eql(Range.create(1, 0, 1, 8));
        });

        it("should warn on a name that never reaches the index, like Date", () => {
            const callbacks = parseVars("Date: 1");

            expect(callbacks.errors.length).to.equal(1);
            expect(callbacks.errors[0].range).to.eql(Range.create(1, 0, 1, 4));
        });

        it("should call out Chapbook built-ins", () => {
            const callbacks = parseVars("passage.x: 1");
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.message).to.include("Chapbook built-in");
            expect(result.range).to.eql(Range.create(1, 0, 1, 7));
        });

        it("should warn on a name with a condition", () => {
            const callbacks = parseVars("location (a > 1): 2");
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.range).to.eql(Range.create(1, 0, 1, 8));
        });

        it("should warn at every place the variable is set", () => {
            const callbacks = parseVars("location: 1\nlocation: 2");

            expect(callbacks.errors.length).to.equal(2);
        });

        for (const name of ["alert", "prompt", "confirm"]) {
            it(`should warn on ${name}, which is indexed as a story variable when called`, () => {
                const callbacks = parseVars(`${name}: 1`);

                expect(callbacks.errors.length).to.equal(1);
                expect(callbacks.errors[0].message).to.include(
                    "browser global",
                );
            });
        }

        it("should warn on setting alert even though calling it is indexed as a read", () => {
            const callbacks = parseVars(
                "alert: 1",
                "[JavaScript]\nalert(x);\n[continue]\n",
            );

            expect(callbacks.errors.length).to.equal(1);
            expect(callbacks.errors[0].range).to.eql(Range.create(1, 0, 1, 5));
            expect(
                callbacks.references.filter((r) => r.contents === "alert"),
            ).to.have.length(2);
        });

        it("should not warn when the diagnostic is disabled for the passage", () => {
            const callbacks = parseVars(
                "location: 'cave'",
                "",
                new Set([DiagnosticCodes.ChapbookVariableShadowedByBrowser]),
            );

            expect(callbacks.errors).to.be.empty;
        });

        for (const line of [
            "name: 'Bob'",
            "loc: 1",
            "config.x: 1",
            "sound.x: 1",
            "trail: []",
        ]) {
            it(`should not warn on "${line}"`, () => {
                expect(parseVars(line).errors).to.be.empty;
            });
        }
    });

    describe("engine.state.set", () => {
        it("should warn on a shadowed string-literal name", () => {
            const callbacks = parseScript("engine.state.set('history', 1);\n");
            const [result] = callbacks.errors;

            expect(callbacks.errors.length).to.equal(1);
            expect(result.range).to.eql(Range.create(1, 18, 1, 25));
        });

        it("should underline only the first segment of a dotted name", () => {
            const callbacks = parseScript(
                "engine.state.set('history.x', 1);\n",
            );

            expect(callbacks.errors.length).to.equal(1);
            expect(callbacks.errors[0].range).to.eql(
                Range.create(1, 18, 1, 25),
            );
        });

        it("should skip computed names and unshadowed names", () => {
            expect(parseScript("engine.state.set(n, 1);\n").errors).to.be.empty;
            expect(parseScript("engine.state.set('loc', 1);\n").errors).to.be
                .empty;
        });
    });
});
