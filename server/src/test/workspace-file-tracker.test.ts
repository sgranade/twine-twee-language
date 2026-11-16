import "mocha";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../project-index";
import {
    WorkspaceFileTracker,
    WorkspaceFileTrackerDeps,
} from "../workspace-file-tracker";

function doc(uri: string): TextDocument {
    return TextDocument.create(uri, "twee3", 1, "");
}

function build(overrides: Partial<WorkspaceFileTrackerDeps> = {}) {
    const calls: string[] = [];
    let time = 1000;
    const index = new Index();
    const deps: WorkspaceFileTrackerDeps = {
        clock: {
            now: () => time,
            setInterval: () => 1,
            clearInterval: () => {},
        },
        index,
        getOpenDocument: () => undefined,
        getAllOpenDocuments: () => [],
        readFile: async (uri) => doc(uri),
        findTweeFiles: async () => ["file:///a.tw", "file:///b.tw"],
        findFiles: async () => [],
        indexStoryData: (d) => void calls.push(`story:${d.uri}`),
        parseDocument: async (d, _level, reindex) =>
            void calls.push(`parse:${d.uri}:${reindex}`),
        validateDocument: async (d) => void calls.push(`validate:${d.uri}`),
        sendDecorationRanges: (uri) => void calls.push(`decor:${uri}`),
        onStoryFormatChange: () => {},
        processAllOpenDocuments: async () => void calls.push("processAll"),
        parseMacroFile: async (uri) => void calls.push(`macro:${uri}`),
        onMacroChanges: () => void calls.push("macroChanges"),
        indexingStarted: () => void calls.push("started"),
        indexingComplete: () => void calls.push("complete"),
        logError: (m) => void calls.push(`error:${m}`),
        ...overrides,
    };
    return {
        tracker: new WorkspaceFileTracker(deps),
        calls,
        index,
        advance: (ms: number) => (time += ms),
    };
}

describe("Workspace File Tracker", () => {
    it("should index every Twee file in stages when the workspace is requested", async () => {
        const { tracker, calls } = build();

        tracker.indexWorkspace();
        await tracker.run();

        expect(calls).to.eql([
            "started",
            "story:file:///a.tw",
            "story:file:///b.tw",
            "parse:file:///a.tw:false",
            "parse:file:///b.tw:false",
            "validate:file:///a.tw",
            "validate:file:///b.tw",
            "complete",
        ]);
    });

    it("should parse, validate and decorate individually requested files", async () => {
        const { tracker, calls } = build();

        tracker.indexFile("file:///c.tw");
        await tracker.run();

        expect(calls).to.eql([
            "parse:file:///c.tw:true",
            "validate:file:///c.tw",
            "decor:file:///c.tw",
        ]);
    });

    it("should wait the minimum time between runs", async () => {
        const { tracker, calls, advance } = build();

        tracker.indexFile("file:///c.tw");
        await tracker.run();
        tracker.indexFile("file:///d.tw");
        await tracker.run();
        const afterFirst = calls.length;
        advance(100);
        await tracker.run();

        expect(afterFirst).to.eql(3);
        expect(calls.length).to.eql(6);
    });

    it("should prefer an open document over reading the file", async () => {
        const open = TextDocument.create("file:///c.tw", "twee3", 7, "open");
        const { tracker, calls } = build({
            getOpenDocument: (uri) => (uri === open.uri ? open : undefined),
            readFile: async () => {
                throw new Error("should not read");
            },
        });

        tracker.indexFile(open.uri);
        await tracker.run();

        expect(calls).to.include("parse:file:///c.tw:true");
    });

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
        const { tracker, calls } = build();

        await tracker.handleFilesCreated(["file:///n.tw", "file:///n.txt"]);
        await tracker.run();

        expect(calls).to.eql([
            "processAll",
            "parse:file:///n.tw:true",
            "validate:file:///n.tw",
            "decor:file:///n.tw",
        ]);
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
