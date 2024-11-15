import "mocha";
import { expect } from "chai";

import * as uut from "../../build/utilities";

describe("Build Utilities", () => {
    it("Escape HTML entities should escape &, <, >, \", and '", () => {
        const src = "Test for \" ' ' \" &lt; <>";

        const result = uut.escapeHtmlEntities(src);

        expect(result).to.equal(
            "Test for &quot; &#39; &#39; &quot; &amp;lt; &lt;&gt;"
        );
    });

    it("Escape attribute entities should escape &, \", and '", () => {
        const src = "Test for \" ' ' \" &lt; <>";

        const result = uut.escapeAttrEntities(src);

        expect(result).to.equal(
            "Test for &quot; &#39; &#39; &quot; &amp;lt; <>"
        );
    });
});
