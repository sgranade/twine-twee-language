import "mocha";
import { expect } from "chai";

import {
    Parameters,
    parseMacroParameters,
} from "../../../../passage-text-parsers/sugarcube/sc2/t3lt-parameters";

import * as uut from "../../../../passage-text-parsers/sugarcube/macros";
import { buildMacroInfo } from "./macro-builders";

describe("SugarCube Macros", () => {
    describe("argument parsing", () => {
        Object.values(uut.all())
            .filter((macro) => Array.isArray(macro.arguments))
            .forEach((macro) => {
                it(`should successfully parse ${macro.name} arguments`, () => {
                    // Type checking for TypeScript's sake -- it can't reason about the above filter
                    if (!Array.isArray(macro.arguments)) return;

                    const result = parseMacroParameters(macro.arguments, {});

                    expect((result as Error).message).to.be.undefined;
                });
            });
    });

    describe("custom macros", () => {
        it("should make custom macros from all documents available in the all() function", () => {
            const firstMacro = buildMacroInfo({ name: "first" });
            const secondMacro = buildMacroInfo({
                name: "second",
                container: true,
            });

            uut.setCustomMacros("uri-1", [firstMacro]);
            uut.setCustomMacros("uri-2", [secondMacro]);
            const result = uut.all();

            expect(result["first"]).to.eql(firstMacro);
            expect(result["second"]).to.eql(secondMacro);
        });

        it("should parse a custom macro's argument", () => {
            const macro = buildMacroInfo({ name: "first" });
            macro.arguments = ["text"];

            uut.setCustomMacros("uri-1", [macro]);
            const result = uut.all()["first"];

            expect(result.parsedArguments).is.instanceOf(Parameters);
        });

        it("should not parse a custom macro's malformed argument", () => {
            const macro = buildMacroInfo({ name: "first" });
            macro.arguments = ["this-is-not-a-thing"];

            uut.setCustomMacros("uri-1", [macro]);
            const result = uut.all()["first"];

            expect(result.parsedArguments).to.be.undefined;
        });

        it("should delete custom macros from a document when requested", () => {
            const firstMacro = buildMacroInfo({ name: "first" });
            const secondMacro = buildMacroInfo({
                name: "second",
                container: true,
            });

            uut.setCustomMacros("uri-1", [firstMacro]);
            uut.setCustomMacros("uri-2", [secondMacro]);
            uut.removeCustomMacroDocument("uri-1");
            const result = uut.all();

            expect(result["first"]).to.be.undefined;
            expect(result["second"]).to.eql(secondMacro);
        });
    });
});
