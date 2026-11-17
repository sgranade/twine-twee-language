import "mocha";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";

import { Index } from "../project-index";

import * as uut from "../indexing-queue";

function doc(uri: string): TextDocument {
    return TextDocument.create(uri, "twee3", 1, "");
}

function build(overrides: Partial<uut.IndexingQueueDeps> = {}) {
    const calls: string[] = [];
    let time = 1000;
    const index = new Index();
    const deps: uut.IndexingQueueDeps = {
        clock: {
            now: () => time,
            setInterval: () => 1,
            clearInterval: () => {},
        },
        index,
        getOpenDocument: () => undefined,
        getAllOpenDocuments: () => [],
        readFile: async (uri) => doc(uri),
        findProjectFiles: async () => ({
            tweeFiles: ["file:///a.tw", "file:///b.tw"],
            storyScriptFiles: [],
            includedScripts: [],
        }),
        findFiles: async () => [],
        indexStoryData: (d) => void calls.push(`story:${d.uri}`),
        indexScriptFile: (d, role) =>
            void calls.push(`script:${role}:${d.uri}`),
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
        queue: new uut.IndexingQueue(deps),
        calls,
        index,
        advance: (ms: number) => (time += ms),
    };
}

describe("Indexing Queue", () => {
    it("should index every Twee file in stages when the workspace is requested", async () => {
        const { queue, calls } = build();

        queue.indexWorkspace();
        await queue.run();

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

    it("should index script files after every Twee file and never validate them", async () => {
        const { queue, calls } = build({
            findProjectFiles: async () => ({
                tweeFiles: ["file:///a.tw"],
                storyScriptFiles: ["file:///s.js"],
                includedScripts: ["file:///i.js"],
            }),
        });

        queue.indexWorkspace();
        await queue.run();

        expect(calls).to.eql([
            "started",
            "story:file:///a.tw",
            "parse:file:///a.tw:false",
            "script:story-script:file:///s.js",
            "script:included-script:file:///i.js",
            "validate:file:///a.tw",
            "complete",
        ]);
    });

    it("should parse, validate and decorate individually requested files", async () => {
        const { queue, calls } = build();

        queue.indexFile("file:///c.tw");
        await queue.run();

        expect(calls).to.eql([
            "parse:file:///c.tw:true",
            "validate:file:///c.tw",
            "decor:file:///c.tw",
        ]);
    });

    it("should wait the minimum time between runs", async () => {
        const { queue, calls, advance } = build();

        queue.indexFile("file:///c.tw");
        await queue.run();
        queue.indexFile("file:///d.tw");
        await queue.run();
        const afterFirst = calls.length;
        advance(100);
        await queue.run();

        expect(afterFirst).to.eql(3);
        expect(calls.length).to.eql(6);
    });

    it("should prefer an open document over reading the file", async () => {
        const open = TextDocument.create("file:///c.tw", "twee3", 7, "open");
        const { queue, calls } = build({
            getOpenDocument: (uri) => (uri === open.uri ? open : undefined),
            readFile: async () => {
                throw new Error("should not read");
            },
        });

        queue.indexFile(open.uri);
        await queue.run();

        expect(calls).to.include("parse:file:///c.tw:true");
    });
});
