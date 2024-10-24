import "mocha";
import { expect } from "chai";

import { parseMacroParameters } from "../../../../passage-text-parsers/sugarcube/sc2/t3lt-parameters";

import * as uut from "../../../../passage-text-parsers/sugarcube/macros";

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
});
