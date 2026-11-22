import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes, ProjectFiles } from "@tt3/shared";
import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { IndexingQueue } from "../indexing-queue";
import { ParseLevel } from "../parser-types";
import { Index } from "../project-index";
import { generateRenames } from "../renames";
import { generateDiagnostics } from "../validator";

import * as uut from "../workspace-file-tracker";

const storyUri = "file:///story.tw";
const otherUri = "file:///other.tw";

let fakeClock: sinon.SinonFakeTimers;

function twee(uri: string, text: string) {
    return TextDocument.create(uri, "twee3", 1, text);
}

function build(
    overrides: Partial<uut.WorkspaceFileTrackerDeps> = {},
    setsKnown = true,
) {
    const calls: string[] = [];
    const queued: string[] = [];
    const index = new Index();
    const deps: uut.WorkspaceFileTrackerDeps = {
        index,
        queue: {
            indexFile: (uri) => void queued.push(uri),
            indexWorkspace: () => void calls.push("indexWorkspace"),
        },
        findProjectFiles: async () => ({
            tweeFiles: [storyUri, otherUri, "file:///new.tw"],
            storyScriptFiles: [],
            includedScripts: [],
        }),
        isOpen: () => false,
        parseMacroFile: async (uri) => void calls.push(`macro:${uri}`),
        onMacroChanges: () => void calls.push("macroChanges"),
        logError: (message) => void calls.push(`error:${message}`),
        indexScriptFile: (doc) => void calls.push(`script:${doc.uri}`),
        readDocument: async (uri) => twee(uri, ""),
        scriptFilesChanged: (uris) => void calls.push(`files:${uris}`),
        revalidateOpenTweeDocuments: async () => void calls.push("revalidate"),
        ...overrides,
    };
    const tracker = new uut.WorkspaceFileTracker(deps);
    if (setsKnown) {
        tracker.setFileSets({
            tweeFiles: [storyUri, otherUri],
            storyScriptFiles: [],
            includedScripts: [],
        });
    }
    return { tracker, calls, queued, index };
}

/**
 * A tracker wired to a real indexing queue and index over a fake disk so's
 * tests can assert what ends up in the index and in diagnostics.
 */
function harness(
    disk: Record<string, string>,
    {
        open = {},
        findProjectFiles,
    }: {
        open?: Record<string, string>;
        findProjectFiles?: () => Promise<ProjectFiles>;
    } = {},
) {
    const files = new Map(Object.entries(disk));
    const scripts = { story: [] as string[], included: [] as string[] };
    const registrations: string[][] = [];
    const openDocs = new Map(
        Object.entries(open).map(([uri, text]) => [uri, twee(uri, text)]),
    );
    const index = new Index();
    const diagnostics = new Map<string, Diagnostic[]>();
    const counts = { resolves: 0, workspaceIndexes: 0, revalidations: 0 };
    const missingPassageHistory: number[] = [];
    const errors: string[] = [];
    const exists = (uris: string[]) => uris.filter((u) => files.has(u));
    const resolve =
        findProjectFiles ??
        (async () => ({
            tweeFiles: [...files.keys()].filter((uri) => uri.endsWith(".tw")),
            storyScriptFiles: exists(scripts.story),
            includedScripts: exists(scripts.included),
        }));
    const countedResolve = () => {
        counts.resolves++;
        return resolve();
    };
    const validate = async (doc: TextDocument) =>
        void diagnostics.set(doc.uri, await generateDiagnostics(doc, index));
    const revalidateOpenTweeDocuments = async () => {
        for (const doc of openDocs.values()) await validate(doc);
        counts.revalidations++;
        missingPassageHistory.push(
            [...openDocs.keys()].reduce(
                (n, uri) => n + missingPassages(uri),
                0,
            ),
        );
    };
    const noop = () => {};
    const readDocument = async (uri: string) => {
        const text = files.get(uri);
        return (
            openDocs.get(uri) ??
            (text === undefined ? undefined : twee(uri, text))
        );
    };
    let tracker: uut.WorkspaceFileTracker;
    const queue = new IndexingQueue({
        index,
        getOpenDocument: (uri) => openDocs.get(uri),
        getAllOpenDocuments: () => [...openDocs.values()],
        readDocument,
        findProjectFiles: countedResolve,
        findFiles: async () => [],
        indexStoryData: (doc) =>
            updateProjectIndex(doc, ParseLevel.StoryData, index),
        indexScriptFile: (doc, role) =>
            updateScriptFileIndex(doc, role, ParseLevel.Full, index),
        parseDocument: async (doc, level) =>
            updateProjectIndex(doc, level, index),
        validateDocument: validate,
        sendDecorationRanges: noop,
        onStoryFormatChange: noop,
        processAllOpenDocuments: async () => {},
        parseMacroFile: async () => {},
        onMacroChanges: noop,
        fileSetsResolved: (sets) => tracker.setFileSets(sets),
        revalidateOpenTweeDocuments,
        indexingStarted: () => void counts.workspaceIndexes++,
        indexingComplete: noop,
        logError: noop,
    });
    tracker = new uut.WorkspaceFileTracker({
        index,
        queue,
        findProjectFiles: countedResolve,
        isOpen: (uri) => openDocs.has(uri),
        parseMacroFile: async () => {},
        onMacroChanges: noop,
        logError: (message) => void errors.push(message),
        indexScriptFile: (doc, role) =>
            updateScriptFileIndex(doc, role, ParseLevel.Full, index),
        readDocument,
        scriptFilesChanged: (uris) => void registrations.push(uris),

        revalidateOpenTweeDocuments,
    });
    /** Run the queue until it has nothing left to do. */
    const drain = async () => {
        for (let i = 0; i < 5; i++) {
            fakeClock.setSystemTime(Date.now() + 1000);
            await queue.run();
        }
    };
    /** Index the workspace as the server does on startup, then reset the counts. */
    const start = async () => {
        queue.indexWorkspace();
        await drain();
        await revalidateOpenTweeDocuments();
        counts.resolves = 0;
        counts.workspaceIndexes = 0;
        counts.revalidations = 0;
        missingPassageHistory.length = 0;
    };
    const neverSet = (uri: string) =>
        (diagnostics.get(uri) ?? []).filter(
            (d) => d.code === DiagnosticCodes.VariableNeverSet,
        ).length;
    const missingPassages = (uri: string) =>
        (diagnostics.get(uri) ?? []).filter(
            (d) => d.code === DiagnosticCodes.MissingPassage,
        ).length;
    return {
        tracker,
        index,
        files,
        openDocs,
        counts,
        errors,
        drain,
        start,
        missingPassages,
        missingPassageHistory,
        neverSet,
        revalidateOpenTweeDocuments,
        scripts,
        registrations,
    };
}

const storyText =
    ':: StoryData\n{"ifid": "x", "format": "SugarCube", "format-version": "2.36.1"}\n\n:: Start\n[[Next]]\n';
const nextText = ":: Next\nHello\n";
const goldStoryText =
    ':: StoryData\n{"ifid": "x", "format": "SugarCube", "format-version": "2.36.1"}\n\n:: Start\n<<print $gold>>\n';
const scriptUri = "file:///s.js";
const setsGold = "State.variables.gold = 1;\n";

describe("Workspace File Tracker", () => {
    beforeEach(() => {
        fakeClock = sinon.useFakeTimers();
    });

    afterEach(() => {
        fakeClock.restore();
    });

    describe("Twee Files on Disk", () => {
        it("should re-index a closed Twee file changed on disk and update diagnostics", async () => {
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [storyUri]: storyText } },
            );
            await h.start();
            expect(h.missingPassages(storyUri)).to.eql(0);

            h.files.set(otherUri, ":: Elsewhere\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "changed" },
            ]);
            await h.drain();

            expect(h.index.getPassageNames()).to.include("Elsewhere");
            expect(h.index.getPassageNames()).not.to.include("Next");
            expect(h.missingPassages(storyUri)).to.eql(1);
        });

        it("should keep the synced buffer when an open Twee file changes on disk", async () => {
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [otherUri]: nextText } },
            );
            await h.start();

            h.files.set(otherUri, ":: Elsewhere\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "changed" },
            ]);
            await h.drain();

            expect(h.index.getPassageNames()).to.include("Next");
            expect(h.index.getPassageNames()).not.to.include("Elsewhere");
        });

        it("should ignore changes to files outside the resolved sets", async () => {
            const h = harness({ [storyUri]: storyText });
            await h.start();

            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///stray.txt", kind: "changed" },
                { uri: "file:///atwork.js", kind: "deleted" },
            ]);
            await h.drain();

            expect(h.index.getIndexedUris()).to.eql([storyUri]);
        });

        it("should restore the on-disk contents when an edited buffer closes unsaved", async () => {
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [otherUri]: ":: Unsaved\n" } },
            );
            await h.start();
            expect(h.index.getPassageNames()).to.include("Unsaved");

            h.openDocs.delete(otherUri);
            await h.tracker.handleDocumentClosed(otherUri);
            await h.drain();

            expect(h.index.getPassageNames()).to.include("Next");
            expect(h.index.getPassageNames()).not.to.include("Unsaved");
        });

        it("should remove a deleted Twee file and revalidate open documents", async () => {
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [storyUri]: storyText } },
            );
            await h.start();

            h.files.delete(otherUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "deleted" },
            ]);
            expect(h.index.getIndexedUris()).to.eql([storyUri]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.missingPassages(storyUri)).to.eql(1);
            expect(h.counts.workspaceIndexes).to.eql(0);
        });

        it("should reindex the workspace once and clear the format when the StoryData file is deleted", async () => {
            const h = harness({ [storyUri]: storyText, [otherUri]: nextText });
            await h.start();
            expect(h.index.getStoryData()).not.to.be.undefined;

            h.files.delete(storyUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: storyUri, kind: "deleted" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.counts.workspaceIndexes).to.eql(1);
            expect(h.index.getStoryData()).to.be.undefined;
        });

        it("should rediscover StoryData when its file is renamed", async () => {
            const movedUri = "file:///moved.tw";
            const h = harness({ [storyUri]: storyText, [otherUri]: nextText });
            await h.start();

            h.files.delete(storyUri);
            h.files.set(movedUri, storyText);
            await h.tracker.handleWatchedFileChanges([
                { uri: storyUri, kind: "deleted" },
                { uri: movedUri, kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.counts.workspaceIndexes).to.eql(1);
            expect(h.counts.resolves).to.eql(1);
            expect(h.index.getStoryDataUri()).to.eql(movedUri);
            expect(h.index.getIndexedUris()).not.to.include(storyUri);
        });

        it("should treat a rename as a delete plus a create", async () => {
            const renamedUri = "file:///renamed.tw";
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [storyUri]: storyText } },
            );
            await h.start();

            h.files.delete(otherUri);
            h.files.set(renamedUri, nextText);
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "deleted" },
                { uri: renamedUri, kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.index.getIndexedUris()).to.have.members([
                storyUri,
                renamedUri,
            ]);
            expect(h.missingPassages(storyUri)).to.eql(0);
        });

        it("should not show missing-passage diagnostics partway through a rename", async () => {
            const renamedUri = "file:///renamed.tw";
            const h = harness(
                { [storyUri]: storyText, [otherUri]: nextText },
                { open: { [storyUri]: storyText } },
            );
            await h.start();

            h.files.delete(otherUri);
            h.files.set(renamedUri, nextText);
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "deleted" },
                { uri: renamedUri, kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.missingPassageHistory).to.not.be.empty;
            expect(h.missingPassageHistory).to.not.include(1);
        });

        it("should revalidate once for a burst of Twee deletes", async () => {
            const thirdUri = "file:///third.tw";
            const h = harness(
                {
                    [storyUri]: storyText,
                    [otherUri]: nextText,
                    [thirdUri]: ":: Third\n",
                },
                { open: { [storyUri]: storyText } },
            );
            await h.start();

            h.files.delete(otherUri);
            h.files.delete(thirdUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "deleted" },
            ]);
            await h.tracker.handleWatchedFileChanges([
                { uri: thirdUri, kind: "deleted" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.index.getIndexedUris()).to.eql([storyUri]);
            expect(h.counts.revalidations).to.eql(1);
            expect(h.counts.resolves).to.eql(0);
        });

        it("should combine a burst of creates into one re-resolve after the debounce", async () => {
            const h = harness({ [storyUri]: storyText });
            await h.start();

            for (const name of ["a", "b", "c"]) {
                const uri = `file:///${name}.tw`;
                h.files.set(uri, `:: ${name}\n`);
                await h.tracker.handleWatchedFileChanges([
                    { uri, kind: "created" },
                ]);
                await fakeClock.tickAsync(uut.fileEventDebounceMs - 1);
            }
            expect(h.counts.resolves).to.eql(0);
            await fakeClock.tickAsync(1);
            await h.drain();

            expect(h.counts.resolves).to.eql(1);
            expect(h.index.getPassageNames()).to.include.members([
                "a",
                "b",
                "c",
            ]);
        });

        it("should not index created files outside the resolved sets", async () => {
            const h = harness({ [storyUri]: storyText });
            await h.start();

            h.files.set("file:///stray.txt", ":: Stray\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///stray.txt", kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            await h.drain();

            expect(h.index.getIndexedUris()).to.eql([storyUri]);
        });

        it("should apply re-resolves in order so a slow one can't overwrite a newer one", async () => {
            let gate: Promise<void> | undefined;
            let files: Map<string, string> = new Map();
            const h = harness(
                { [storyUri]: storyText },
                {
                    findProjectFiles: async () => {
                        const tweeFiles = [...files.keys()];
                        await gate;
                        return {
                            tweeFiles,
                            storyScriptFiles: [],
                            includedScripts: [],
                        };
                    },
                },
            );
            files = h.files;
            await h.start();
            let release: () => void = () => {};
            gate = new Promise((resolve) => (release = resolve));

            h.files.set("file:///a.tw", ":: A\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///a.tw", kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            gate = undefined;
            h.files.set("file:///b.tw", ":: B\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///b.tw", kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);
            release();
            await fakeClock.tickAsync(0);
            await h.drain();
            h.files.set("file:///b.tw", ":: B2\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///b.tw", kind: "changed" },
            ]);
            await h.drain();

            expect(h.index.getPassageNames()).to.include.members(["A", "B2"]);
        });

        it("should resolve the file sets for events arriving before the first index", async () => {
            const h = harness({ [storyUri]: storyText, [otherUri]: nextText });

            await h.tracker.handleWatchedFileChanges([
                { uri: otherUri, kind: "changed" },
            ]);
            await h.drain();

            expect(h.counts.resolves).to.eql(1);
            expect(h.index.getPassageNames()).to.include("Next");
        });

        it("should log and drop the event if resolving the file sets fails", async () => {
            const h = harness(
                { [storyUri]: storyText },
                {
                    findProjectFiles: async () => {
                        throw new Error("boom");
                    },
                },
            );

            await h.tracker.handleWatchedFileChanges([
                { uri: storyUri, kind: "changed" },
            ]);
            await h.drain();

            expect(h.errors).to.have.length(1);
            expect(h.counts.workspaceIndexes).to.eql(0);
            expect(h.index.getIndexedUris()).to.eql([]);
        });
    });

    it("should reparse a changed macro config file", async () => {
        const { tracker, calls } = build();

        await tracker.handleWatchedFileChanges([
            { uri: "file:///x.twee-config.json", kind: "changed" },
        ]);

        expect(calls).to.eql([
            "macro:file:///x.twee-config.json",
            "macroChanges",
        ]);
    });

    describe("Script Files on Disk", () => {
        const startWithScript = async (
            role: "story" | "included" = "story",
            open: Record<string, string> = { [storyUri]: goldStoryText },
        ) => {
            const h = harness(
                { [storyUri]: goldStoryText, [scriptUri]: setsGold },
                { open },
            );
            h.scripts[role].push(scriptUri);
            await h.start();
            return h;
        };

        it("should index a created matched .js file and add it to the selector", async () => {
            const h = harness(
                { [storyUri]: goldStoryText },
                { open: { [storyUri]: goldStoryText } },
            );
            await h.start();
            expect(h.neverSet(storyUri)).to.eql(1);

            h.files.set(scriptUri, setsGold);
            h.scripts.story.push(scriptUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: scriptUri, kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.index.getScriptFileRole(scriptUri)).to.eql("story-script");
            expect(h.registrations).to.eql([[scriptUri]]);
            expect(h.neverSet(storyUri)).to.eql(0);
        });

        it("should remove a deleted .js file's occurrences and update the selector", async () => {
            const h = await startWithScript();
            expect(h.neverSet(storyUri)).to.eql(0);

            h.files.delete(scriptUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: scriptUri, kind: "deleted" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.index.isScriptFile(scriptUri)).to.be.false;
            expect(h.registrations).to.eql([[]]);
            expect(h.neverSet(storyUri)).to.eql(1);
        });

        it("should drop a deleted .js file's occurrences before the debounce fires", async () => {
            const h = await startWithScript();

            h.files.delete(scriptUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: scriptUri, kind: "deleted" },
            ]);
            const tw = h.openDocs.get(storyUri)!;
            const edit = generateRenames(
                storyUri,
                tw.positionAt(tw.getText().indexOf("gold")),
                "silver",
                h.index,
            ) as { changes: Record<string, unknown[]> };

            expect(edit.changes[scriptUri]).to.be.undefined;
            expect(h.registrations).to.eql([]);
        });

        it("should still update the selector for a deleted .js file if re-resolving fails", async () => {
            let fail = false;
            const files: { tw: string[]; story: string[] } = {
                tw: [storyUri],
                story: [scriptUri],
            };
            const h = harness(
                { [storyUri]: goldStoryText, [scriptUri]: setsGold },
                {
                    open: { [storyUri]: goldStoryText },
                    findProjectFiles: async () => {
                        if (fail) throw new Error("boom");
                        return {
                            tweeFiles: files.tw,
                            storyScriptFiles: files.story,
                            includedScripts: [],
                        };
                    },
                },
            );
            await h.start();
            fail = true;

            h.files.delete(scriptUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: scriptUri, kind: "deleted" },
                { uri: "file:///new.tw", kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.errors).to.have.length(1);
            expect(h.registrations).to.eql([[]]);
            expect(h.neverSet(storyUri)).to.eql(1);
        });

        it("should re-index a closed .js file changed on disk", async () => {
            const h = await startWithScript();

            h.files.set(scriptUri, "// nothing\n");
            await h.tracker.handleWatchedFileChanges([
                { uri: scriptUri, kind: "changed" },
            ]);

            expect(h.neverSet(storyUri)).to.eql(1);
            expect(h.registrations).to.eql([]);
        });

        it("should re-parse a file that moves from included script to story script", async () => {
            const h = await startWithScript("included");
            expect(h.index.getScriptFileRole(scriptUri)).to.eql(
                "included-script",
            );

            h.scripts.included.length = 0;
            h.scripts.story.push(scriptUri);
            await h.tracker.handleWatchedFileChanges([
                { uri: "file:///other.js", kind: "created" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.index.getScriptFileRole(scriptUri)).to.eql("story-script");
            expect(h.registrations).to.eql([]);
        });

        it("should re-resolve once for a burst of .js creates", async () => {
            const h = await startWithScript();

            for (const name of ["a", "b", "c"]) {
                await h.tracker.handleWatchedFileChanges([
                    { uri: `file:///${name}.js`, kind: "created" },
                ]);
            }
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.counts.resolves).to.eql(1);
        });

        it("should ignore .js files outside the resolved sets", async () => {
            const h = await startWithScript();
            const vendorUri = "file:///vendor.js";
            h.files.set(vendorUri, setsGold);

            await h.tracker.handleWatchedFileChanges([
                { uri: vendorUri, kind: "created" },
                { uri: vendorUri, kind: "changed" },
            ]);
            await fakeClock.tickAsync(uut.fileEventDebounceMs);

            expect(h.index.isScriptFile(vendorUri)).to.be.false;
            expect(h.registrations).to.eql([]);
        });

        it("should restore the on-disk contents when an edited but unsaved .js buffer closes", async () => {
            const h = await startWithScript();
            const edited = TextDocument.create(
                scriptUri,
                "javascript",
                2,
                "// nothing\n",
            );
            updateScriptFileIndex(
                edited,
                "story-script",
                ParseLevel.Full,
                h.index,
            );
            await h.revalidateOpenTweeDocuments();
            expect(h.neverSet(storyUri)).to.eql(1);

            await h.tracker.handleDocumentClosed(scriptUri);

            expect(h.neverSet(storyUri)).to.eql(0);
        });
    });

    describe("Open Script File/Buffer Handling", () => {
        const jsDoc = TextDocument.create("file:///a.js", "javascript", 1, "x");
        /** Resolve the buffer's file as a story script file. */
        const resolveAsStoryScript = (tracker: uut.WorkspaceFileTracker) =>
            tracker.setFileSets({
                tweeFiles: [storyUri],
                storyScriptFiles: [jsDoc.uri],
                includedScripts: [],
            });

        it("should combine a bunch of script file edits into one re-parse after the debounce", () => {
            const { tracker, calls } = build();
            resolveAsStoryScript(tracker);

            tracker.handleScriptFileChanged(jsDoc);
            fakeClock.tick(uut.scriptReparseDebounceMs - 1);
            tracker.handleScriptFileChanged(jsDoc);
            fakeClock.tick(uut.scriptReparseDebounceMs - 1);
            tracker.handleScriptFileChanged(jsDoc);
            fakeClock.tick(uut.scriptReparseDebounceMs - 1);
            expect(calls).to.eql([]);
            fakeClock.tick(1);

            expect(calls).to.eql(["script:file:///a.js", "revalidate"]);
        });

        it("should flush pending script files synchronously", () => {
            const { tracker, calls } = build();
            resolveAsStoryScript(tracker);

            tracker.handleScriptFileChanged(jsDoc);
            tracker.indexPendingScripts();
            fakeClock.runAll();

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
            resolveAsStoryScript(tracker);
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
