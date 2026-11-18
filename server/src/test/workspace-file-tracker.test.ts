import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { TextDocument } from "vscode-languageserver-textdocument";

import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index } from "../project-index";
import { generateRenames } from "../renames";

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
        indexScriptFile: (doc) => void calls.push(`script:${doc.uri}`),
        revalidateOpenTweeDocuments: async () => void calls.push("revalidate"),
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

    describe("Open Script File Handling", () => {
        const jsDoc = TextDocument.create("file:///a.js", "javascript", 1, "x");
        let clock: sinon.SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
        });

        afterEach(() => {
            clock.restore();
        });

        it("should coalesce a burst of script file edits into one re-parse after the debounce", () => {
            const { tracker, calls, index } = build();
            index.setScriptFileRole(jsDoc.uri, "story-script");

            tracker.handleScriptFileChanged(jsDoc);
            clock.tick(uut.scriptReparseDebounceMs - 1);
            tracker.handleScriptFileChanged(jsDoc);
            clock.tick(uut.scriptReparseDebounceMs - 1);
            tracker.handleScriptFileChanged(jsDoc);
            clock.tick(uut.scriptReparseDebounceMs - 1);
            expect(calls).to.eql([]);
            clock.tick(1);

            expect(calls).to.eql(["script:file:///a.js", "revalidate"]);
        });

        it("should index pending script files synchronously", () => {
            const { tracker, calls, index } = build();
            index.setScriptFileRole(jsDoc.uri, "story-script");

            tracker.handleScriptFileChanged(jsDoc);
            tracker.indexPendingScripts();
            clock.runAll();

            expect(calls).to.eql(["script:file:///a.js", "revalidate"]);
        });

        it("should do nothing when indexing with nothing pending", () => {
            const { tracker, calls } = build();

            tracker.indexPendingScripts();

            expect(calls).to.eql([]);
        });

        it("should rename using a buffer edited before the debounce fires", () => {
            const index = new Index();
            const { tracker } = build({
                index,
                indexScriptFile: (d, role) =>
                    updateScriptFileIndex(d, role, ParseLevel.Full, index),
            });
            const tw = TextDocument.create(
                "file:///story.tw",
                "twee3",
                1,
                ':: StoryData\n{"ifid": "x", "format": "SugarCube", "format-version": "2.36.1"}\n\n' +
                    ":: Start\n<<print $gold>>\n",
            );
            updateProjectIndex(tw, ParseLevel.Full, index);
            updateScriptFileIndex(
                TextDocument.create(
                    jsDoc.uri,
                    "javascript",
                    1,
                    "State.variables.gold = 1;\n",
                ),
                "story-script",
                ParseLevel.Full,
                index,
            );

            tracker.handleScriptFileChanged(
                TextDocument.create(
                    jsDoc.uri,
                    "javascript",
                    2,
                    "State.variables.gold = 1;\nState.variables.gold += 2;\n",
                ),
            );
            // What the server's request handlers do before answering
            tracker.indexPendingScripts();
            const edit = generateRenames(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("gold")),
                "silver",
                index,
            );

            expect(
                (edit as { changes: Record<string, unknown[]> }).changes[
                    jsDoc.uri
                ],
            ).to.have.length(2);
        });
    });
});
