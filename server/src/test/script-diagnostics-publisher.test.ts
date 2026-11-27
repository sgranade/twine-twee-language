import "mocha";
import { expect } from "chai";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "@tt3/shared";
import { Index } from "../project-index";

import * as uut from "../script-diagnostics-publisher";

const uri = "file:///s.js";
const broken = "engine.extend('abc', () => {});";
const fixed = "engine.extend('1.0.0', () => {});";

function harness() {
    const h = {
        index: new Index(),
        published: [] as { uri: string; diagnostics: Diagnostic[] }[],
        publisher: undefined as unknown as uut.ScriptDiagnosticsPublisher,
        indexFile(content: string) {
            h.publisher.indexScriptFile(
                TextDocument.create(uri, "javascript", 1, content),
                "story-script",
            );
        },
    };
    h.index.setStoryData(
        {
            ifid: "x",
            storyFormat: { format: "Chapbook", formatVersion: "2.0.0" },
        },
        "story-data-uri",
    );
    h.publisher = new uut.ScriptDiagnosticsPublisher({
        index: h.index,
        sendDiagnostics: (uri, diagnostics) =>
            h.published.push({ uri, diagnostics }),
    });
    return h;
}

describe("Script Diagnostics Publisher", () => {
    it("should publish a .js file's diagnostics", () => {
        const h = harness();

        h.indexFile(broken);
        const result = h.published;

        expect(result).to.have.length(1);
        expect(result[0].uri).to.equal(uri);
        expect(result[0].diagnostics).to.have.length(1);
        expect(result[0].diagnostics[0].code).to.equal(
            DiagnosticCodes.ChapbookNonNumericEngineExtensionVersion,
        );
    });

    it("should publish an empty list once a .js file's diagnostics are fixed", () => {
        const h = harness();
        h.indexFile(broken);
        h.published = [];

        h.indexFile(fixed);
        const result = h.published;

        expect(result).to.eql([{ uri, diagnostics: [] }]);
    });

    it("should clear a .js file's diagnostics once when it stops being a script file", () => {
        const h = harness();
        h.indexFile(broken);
        h.published = [];
        h.index.removeDocument(uri);

        h.publisher.clearRemovedScriptDiagnostics();
        h.publisher.clearRemovedScriptDiagnostics();
        const result = h.published;

        expect(result).to.eql([{ uri, diagnostics: [] }]);
    });

    it("should not clear diagnostics for a file that's still a script file", () => {
        const h = harness();
        h.indexFile(broken);
        h.published = [];

        h.publisher.clearRemovedScriptDiagnostics();
        const result = h.published;

        expect(result).to.be.empty;
    });

    it("should publish nothing for a .js file that never had diagnostics", () => {
        const h = harness();

        h.indexFile(fixed);
        const result = h.published;

        expect(result).to.be.empty;
    });
});
