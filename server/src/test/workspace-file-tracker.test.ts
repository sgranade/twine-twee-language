import "mocha";
import { expect } from "chai";

import { Index } from "../project-index";

import * as uut from "../workspace-file-tracker";

function build(overrides: Partial<uut.WorkspaceFileTrackerDeps> = {}) {
    const calls: string[] = [];
    const queued: string[] = [];
    const index = new Index();
    const deps: uut.WorkspaceFileTrackerDeps = {
        index,
        queue: { indexFile: (uri) => void queued.push(uri) },
        processAllOpenDocuments: async () => void calls.push("processAll"),
        parseMacroFile: async (uri) => void calls.push(`macro:${uri}`),
        onMacroChanges: () => void calls.push("macroChanges"),
        ...overrides,
    };
    return {
        tracker: new uut.WorkspaceFileTracker(deps),
        calls,
        queued,
        index,
    };
}

describe("Workspace File Tracker", () => {
    it("should remove a deleted Twee file from the index but ignore other deletions", () => {
        const { tracker, index } = build();
        index.setPassages("file:///a.tw", []);
        index.setPassages("file:///a.txt", []);

        tracker.handleWatchedFileChanges([
            { uri: "file:///a.tw", deleted: true },
            { uri: "file:///a.txt", deleted: true },
        ]);

        expect(index.getIndexedUris()).to.eql(["file:///a.txt"]);
    });

    it("should only treat files ending in .tw or .twee as Twee files", () => {
        const { tracker, index } = build();
        index.setPassages("file:///atwork.js", []);
        index.setPassages("file:///B.TWEE", []);

        tracker.handleWatchedFileChanges([
            { uri: "file:///atwork.js", deleted: true }, // note the "tw" hiding in "atwork"
            { uri: "file:///B.TWEE", deleted: true },
        ]);

        expect(index.getIndexedUris()).to.eql(["file:///atwork.js"]);
    });

    it("should reparse a changed macro config file", () => {
        const { tracker, calls } = build();

        tracker.handleWatchedFileChanges([
            { uri: "file:///x.twee-config.json", deleted: false },
        ]);

        expect(calls).to.eql([
            "macro:file:///x.twee-config.json",
            "macroChanges",
        ]);
    });

    it("should queue created Twee files and reprocess open documents", async () => {
        const { tracker, calls, queued } = build();

        await tracker.handleFilesCreated(["file:///n.tw", "file:///n.txt"]);

        expect(queued).to.eql(["file:///n.tw"]);
        expect(calls).to.eql(["processAll"]);
    });

    it("should rename and remove documents on rename", async () => {
        const { tracker, index } = build();
        index.setPassages("file:///a.tw", []);
        index.setPassages("file:///b.tw", []);

        await tracker.handleFilesRenamed([
            { oldUri: "file:///a.tw", newUri: "file:///c.tw" },
            { oldUri: "file:///b.tw", newUri: "file:///b.txt" },
        ]);

        expect(index.getIndexedUris()).to.eql(["file:///c.tw"]);
    });
});
