import "mocha";
import { expect } from "chai";

import { DiagnosticCodes } from "@tt3/shared";

import * as uut from "../global-disable";

describe("Global Diagnostic Disabling", () => {
    it("should offer the code of a Twine diagnostic with a known code", () => {
        const diagnostics = [
            { source: "Twine", code: DiagnosticCodes.IncorrectJavaScript },
        ];

        const result = uut.codesToDisableGlobally(diagnostics);

        expect(result).to.eql(["incorrect-javascript"]);
    });

    it("should not offer the code of a diagnostic from another source", () => {
        const diagnostics = [{ source: "eslint", code: "no-unused-vars" }];

        const result = uut.codesToDisableGlobally(diagnostics);

        expect(result).to.be.empty;
    });

    it("should not offer an unknown code from a Twine diagnostic", () => {
        const diagnostics = [{ source: "Twine", code: "no-unused-vars" }];

        const result = uut.codesToDisableGlobally(diagnostics);

        expect(result).to.be.empty;
    });
});
