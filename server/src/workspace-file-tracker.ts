import { TextDocument } from "vscode-languageserver-textdocument";

import { isTweeFile, StoryFormat } from "@tt3/shared";
import { ParseLevel } from "./parser-types";
import { Index } from "./project-index";

/**
 * Clock used by the tracker.
 */
export interface Clock {
    now(): number;
    setInterval(callback: () => void, ms: number): unknown;
    clearInterval(handle: unknown): void;
}

/**
 * Everything the tracker needs from the outside world.
 */
export interface WorkspaceFileTrackerDeps {
    clock: Clock;
    index: Pick<
        Index,
        "getIndexedUris" | "removeDocument" | "renameDocument" | "getStoryData"
    >;
    /** Get an open (tracked) document (if it exists). */
    getOpenDocument(uri: string): TextDocument | undefined;
    getAllOpenDocuments(): TextDocument[];
    /** Read a file via the client. */
    readFile(uri: string, langId?: string): Promise<TextDocument | undefined>;
    /** Ask the client for the project's Twee files. */
    findTweeFiles(): Promise<string[]>;
    /** Ask the client for files matching a glob. */
    findFiles(glob: string): Promise<string[]>;
    /** Index a story-data-only pass over a document. */
    indexStoryData(document: TextDocument): void;
    parseDocument(
        document: TextDocument,
        parseLevel: ParseLevel,
        reindexOnStoryFormatChange: boolean,
    ): Promise<void>;
    validateDocument(document: TextDocument): Promise<void>;
    sendDecorationRanges(uri: string): void;
    onStoryFormatChange(format: StoryFormat): void;
    processAllOpenDocuments(): Promise<void>;
    parseMacroFile(uri: string): Promise<void>;
    onMacroChanges(): void;
    indexingStarted(): Promise<void> | void;
    indexingComplete(): void;
    logError(message: string): void;
}

/**
 * Whether a watched file was deleted, as opposed to created or changed.
 */
export interface WatchedFileChange {
    uri: string;
    deleted: boolean;
}

const interval = 200; // Interval between calling the run function, in ms
const minTimeBetween = 50; // Minimum time to wait between runs, in ms

/**
 * Handles watched-file events and runs the indexing queue, which takes
 * care of potentially long-running tasks that shouldn't run concurrently.
 */
export class WorkspaceFileTracker {
    private lastTime = -1; // Last time the queue ran, in ms since epoch
    private timerId: unknown;
    private running = false;

    private requestedFileIndexes: Set<string> = new Set(); // Files to index
    private workspaceIndexRequested = false; // Whether a full project indexing has been requested
    private sugarcubeMacroIndexRequested = false; // Whether we're to index custom SugarCube macro files

    constructor(private readonly deps: WorkspaceFileTrackerDeps) {}

    /**
     * Start processing the indexing queue.
     */
    start(): void {
        this.timerId = this.deps.clock.setInterval(
            () => void this.run(),
            interval,
        );
    }

    /**
     * Stop processing the indexing queue.
     */
    stop(): void {
        this.deps.clock.clearInterval(this.timerId);
    }

    /**
     * Add a new Twee file to index.
     * @param uri URI of the file to index.
     */
    indexFile(uri: string): void {
        this.requestedFileIndexes.add(uri);
    }

    /**
     * Index the Twee 3 files in the workspace.
     */
    indexWorkspace(): void {
        this.workspaceIndexRequested = true;
    }

    /**
     * Index the SugarCube custom macro files in the workspace.
     */
    indexSugarCubeMacros(): void {
        this.sugarcubeMacroIndexRequested = true;
    }

    /**
     * Handle watcher events.
     */
    handleWatchedFileChanges(changes: WatchedFileChange[]): void {
        for (const change of changes) {
            if (change.deleted && isTweeFile(change.uri)) {
                this.deps.index.removeDocument(change.uri);
            } else if (/\.twee-config\.(json|ya?ml)$/.test(change.uri)) {
                void this.deps.parseMacroFile(change.uri);
                this.deps.onMacroChanges();
            }
        }
    }

    async handleFilesCreated(uris: string[]): Promise<void> {
        for (const uri of uris) {
            if (isTweeFile(uri)) {
                this.indexFile(uri);
            }
        }
        await this.deps.processAllOpenDocuments();
    }

    async handleFilesDeleted(uris: string[]): Promise<void> {
        for (const uri of uris) {
            if (isTweeFile(uri)) {
                this.deps.index.removeDocument(uri);
            }
        }
        await this.deps.processAllOpenDocuments();
    }

    async handleFilesRenamed(
        files: { oldUri: string; newUri: string }[],
    ): Promise<void> {
        for (const file of files) {
            if (isTweeFile(file.oldUri)) {
                if (isTweeFile(file.newUri)) {
                    this.deps.index.renameDocument(file.oldUri, file.newUri);
                } else {
                    this.deps.index.removeDocument(file.oldUri);
                }
            }
        }
        await this.deps.processAllOpenDocuments();
    }

    /**
     * Run one pass of the indexing queue.
     */
    async run(): Promise<void> {
        if (
            this.running ||
            this.deps.clock.now() < this.lastTime + minTimeBetween
        ) {
            return;
        }
        try {
            this.running = true;
            // Only do one of the following things during a single pass
            if (this.workspaceIndexRequested) {
                this.requestedFileIndexes.clear(); // since we're indexing everything
                await this.indexAllTweeFiles();
            } else if (this.requestedFileIndexes.size > 0) {
                for (const uri of this.requestedFileIndexes) {
                    const doc = await this.getDoc(uri);
                    if (doc !== undefined) {
                        await this.deps.parseDocument(
                            doc,
                            ParseLevel.Full,
                            true,
                        );
                        await this.deps.validateDocument(doc);
                        this.deps.sendDecorationRanges(doc.uri);
                    }
                }
                this.requestedFileIndexes.clear();
            } else if (this.sugarcubeMacroIndexRequested) {
                await this.indexT3LTMacroFiles();
            }
        } finally {
            this.lastTime = this.deps.clock.now();
            this.running = false;
        }
    }

    /**
     * Get a document, first from our document store, then (if that fails)
     * by requesting it from the client.
     *
     * @param uri Uri to the document.
     * @returns The document, or undefined if it's not available.
     */
    private async getDoc(uri: string): Promise<TextDocument | undefined> {
        // If the doc is open and we're tracking it, use that verison, as otherwise
        // we'll read an old version from disk
        return (
            this.deps.getOpenDocument(uri) ?? (await this.deps.readFile(uri))
        );
    }

    /**
     * Index all Twee files in an opened project, as reported by the client.
     */
    private async indexAllTweeFiles(): Promise<void> {
        const { deps } = this;
        await deps.indexingStarted();

        // Remove all indexed files that aren't in our document store,
        // as we've not opened them and aren't tracking them, and thus
        // only fast-indexed them
        for (const uri of deps.index.getIndexedUris()) {
            if (deps.getOpenDocument(uri) === undefined) {
                deps.index.removeDocument(uri);
            }
        }

        try {
            const tweeFileUris = new Set(await deps.findTweeFiles());

            // We'll loop through the files in stages: first to find a StoryData value,
            // and then to validate.

            // Right now we don't cache the file fetch results so as not to have to
            // potentially hold every file in a project in memory.
            const oldStoryFormat = deps.index.getStoryData()?.storyFormat;
            for (const uri of tweeFileUris) {
                const doc = await this.getDoc(uri);
                if (doc !== undefined) {
                    deps.indexStoryData(doc);
                    // If we get a story format that's different than the old one,
                    // we can stop looking
                    const newStoryFormat =
                        deps.index.getStoryData()?.storyFormat;
                    if (
                        newStoryFormat?.format !== oldStoryFormat?.format ||
                        newStoryFormat?.formatVersion !==
                            oldStoryFormat?.formatVersion
                    ) {
                        break;
                    }
                }
            }
            const newStoryFormat = deps.index.getStoryData()?.storyFormat;
            if (
                newStoryFormat !== undefined &&
                (newStoryFormat?.format !== oldStoryFormat?.format ||
                    newStoryFormat?.formatVersion !==
                        oldStoryFormat?.formatVersion)
            ) {
                deps.onStoryFormatChange(newStoryFormat);

                // The story format change may set up other processing
                // we need before we do a full indexing.
                if (this.sugarcubeMacroIndexRequested) {
                    await this.indexT3LTMacroFiles();
                }
            }

            for (const uri of tweeFileUris) {
                const doc = await this.getDoc(uri);
                if (doc !== undefined) {
                    await deps.parseDocument(
                        doc,
                        ParseLevel.Full,
                        false, // Don't re-index on story format change b/c we're in the middle of re-indexing
                    );
                }
            }

            for (const uri of tweeFileUris) {
                const doc = await this.getDoc(uri);
                if (doc !== undefined) {
                    await deps.validateDocument(doc);
                }
            }

            // Re-process any open documents that we didn't handle above.
            // This could happen if the open document doesn't have an expected extension
            // (like a `.txt` file that the user has selected as being a Twine file).
            const unprocessedOpenDocuments = deps
                .getAllOpenDocuments()
                .filter((d) => !tweeFileUris.has(d.uri));
            for (const doc of unprocessedOpenDocuments) {
                await deps.parseDocument(
                    doc,
                    ParseLevel.Full,
                    false, // Don't re-index on story format change
                );
            }
            for (const doc of unprocessedOpenDocuments) {
                await deps.validateDocument(doc);
            }
        } catch (err) {
            deps.logError(`Client couldn't find Twee files: ${err}`);
        }

        deps.indexingComplete();
        this.workspaceIndexRequested = false;
    }

    /**
     * Index all T3LT SC2 macro files in a workspace
     */
    private async indexT3LTMacroFiles(): Promise<void> {
        const { deps } = this;
        try {
            const sc2MacroFileUris = await deps.findFiles(
                "**/*.twee-config.{json,yaml,yml}",
            );
            for (const uri of sc2MacroFileUris) {
                await deps.parseMacroFile(uri);
            }

            // Once we're done, we need to re-validate any open documents
            await deps.processAllOpenDocuments();

            deps.onMacroChanges();
        } catch (err) {
            deps.logError(
                `Client couldn't find SugarCube 2 macro files: ${err}`,
            );
        }

        this.sugarcubeMacroIndexRequested = false;
    }
}
