import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectFiles } from "@tt3/shared";
import { IndexingQueue } from "./indexing-queue";
import {
    Index,
    ScriptFileRole,
    projectFilesToScriptFileRoles,
} from "./project-index";

/** How long to wait after the last `.js` edit before re-parsing. */
export const scriptReparseDebounceMs = 300;

/** How long to wait after the last file creation/deletion event before doing something with it. */
export const fileEventDebounceMs = 300;

/**
 * Everything the tracker needs from the outside world.
 */
export interface WorkspaceFileTrackerDeps {
    index: Pick<Index, "getStoryDataUri" | "hasDocument" | "removeDocument">;
    queue: Pick<IndexingQueue, "indexFile" | "indexWorkspace">;
    /** Ask the client for the project's resolved file sets. */
    findProjectFiles(): Promise<ProjectFiles>;
    /** Does the editor have the document open? */
    isOpen(uri: string): boolean;
    parseMacroFile(uri: string): Promise<void>;
    onMacroChanges(): void;
    logError(message: string): void;
    indexScriptFile(document: TextDocument, role: ScriptFileRole): void;
    readDocument(uri: string): Promise<TextDocument | undefined>;
    scriptFilesChanged(uris: string[]): void;
    revalidateOpenTweeDocuments(): Promise<void>;
}

/**
 * A change to a watched file.
 */
export interface WatchedFileChange {
    uri: string;
    kind: "created" | "changed" | "deleted";
}

/**
 * Post-delete follow-up work due since we last flushed all file events.
 */
interface PendingPostDeleteWork {
    /** A deleted file held StoryData (requires re-indexing the whole workspace). */
    storyData: boolean;
    /** A deleted file was a resolved `.js` file (requires re-registering features). */
    scriptFiles: boolean;
    /** Something was removed from the index (requires re-validation of open Twee docs). */
    any: boolean;
}

function noPendingPostDeleteWork(): PendingPostDeleteWork {
    return { storyData: false, scriptFiles: false, any: false };
}

/**
 * Handles watched-file events plus open-buffer edits.
 */
export class WorkspaceFileTracker {
    private tweeFiles: Set<string> | undefined;
    private pendingScripts = new Map<string, TextDocument>();
    private scriptRoles: Map<string, ScriptFileRole> | undefined;
    private scriptTimer: ReturnType<typeof setTimeout> | undefined;
    private pendingCreates = new Set<string>();
    private pendingPostDeleteWork = noPendingPostDeleteWork();
    private fileEventTimer: ReturnType<typeof setTimeout> | undefined;
    private resolveChain: Promise<unknown> = Promise.resolve();

    constructor(private readonly deps: WorkspaceFileTrackerDeps) {}

    /**
     * Handle a change to a script file.
     */
    handleScriptFileChange(document: TextDocument): void {
        // Queue the script to be parsed (to debounce rapid edits)
        this.pendingScripts.set(document.uri, document);
        clearTimeout(this.scriptTimer);
        this.scriptTimer = setTimeout(
            () => this.indexPendingScripts(),
            scriptReparseDebounceMs,
        );
    }

    /**
     * Index every pending `.js` buffer.
     */
    indexPendingScripts(): void {
        clearTimeout(this.scriptTimer);
        this.scriptTimer = undefined;
        if (this.pendingScripts.size === 0) return;

        const pending = [...this.pendingScripts.values()];
        this.pendingScripts.clear();
        for (const doc of pending) {
            const role = this.scriptRoles?.get(doc.uri);
            if (role !== undefined) {
                this.deps.indexScriptFile(doc, role);
            }
        }
        // Once we've resolved them all, revalidate open Twee docs since the script might have changed vars
        void this.deps.revalidateOpenTweeDocuments();
    }

    /**
     * Update our cached resolved file sets.
     */
    setFileSets(files: ProjectFiles): void {
        this.tweeFiles = new Set(files.tweeFiles);
        this.scriptRoles = projectFilesToScriptFileRoles(files);
    }

    /**
     * Handle watched-file change events.
     */
    async handleWatchedFileChanges(
        changes: WatchedFileChange[],
    ): Promise<void> {
        const tweeChanges: WatchedFileChange[] = [];
        const scriptChanges: WatchedFileChange[] = [];
        for (const change of changes) {
            if (/\.twee-config\.(json|ya?ml)$/.test(change.uri)) {
                void this.deps.parseMacroFile(change.uri);
                this.deps.onMacroChanges();
            } else if (change.kind === "created") {
                this.pendingCreates.add(change.uri);
                this.scheduleFileEventFlush();
            } else if (change.kind === "deleted") {
                this.handleDeleted(change.uri);
            } else if (change.uri.endsWith(".js")) {
                scriptChanges.push(change);
            } else {
                tweeChanges.push(change);
            }
        }

        if (tweeChanges.length === 0 && scriptChanges.length === 0) return;
        if (!(await this.ensureFileSets())) return;

        // Reindex scripts first since they affect Twine files
        await this.reindexScriptsFromDisk(
            scriptChanges
                .map((c) => c.uri)
                .filter((uri) => !this.deps.isOpen(uri)),
        );
        for (const change of tweeChanges) {
            if (
                this.isTrackedTweeFile(change.uri) &&
                !this.deps.isOpen(change.uri)
            ) {
                this.deps.queue.indexFile(change.uri);
            }
        }
    }

    /**
     * Handle a closed document.
     */
    async handleDocumentClosed(uri: string): Promise<void> {
        if (!(await this.ensureFileSets())) return;
        // Re-read a closed file from disk to get rid of unsaved edits
        if (this.isTrackedTweeFile(uri)) {
            this.deps.queue.indexFile(uri);
        } else {
            await this.reindexScriptsFromDisk([uri]);
        }
    }

    /**
     * Handle a deleted file.
     */
    private handleDeleted(uri: string): void {
        if (!this.deps.index.hasDocument(uri)) return;

        const pending = this.pendingPostDeleteWork;
        if (this.deps.index.getStoryDataUri() === uri) pending.storyData = true;
        if (this.scriptRoles?.delete(uri)) pending.scriptFiles = true;
        // We'll remove it from the index immediately (so it can't be found by
        // e.g. variable location requests) and schedule follow-up work for later.
        this.tweeFiles?.delete(uri);
        this.deps.index.removeDocument(uri);
        pending.any = true;
        // Schedule post-delete follow-ups
        this.scheduleFileEventFlush();
    }

    /**
     * Re-read resolved `.js` files and re-index them.
     */
    private async reindexScriptsFromDisk(uris: string[]): Promise<void> {
        const resolved: [string, ScriptFileRole][] = [];
        for (const uri of uris) {
            const role = this.scriptRoles?.get(uri);
            if (role !== undefined) resolved.push([uri, role]);
        }
        if (await this.reindexScripts(resolved)) {
            // If any were re-indexed, revalidate our open Twee docs
            await this.deps.revalidateOpenTweeDocuments();
        }
    }

    /**
     * Read and re-index `.js` files with the given roles.
     *
     * @returns Whether any file was re-indexed.
     */
    private async reindexScripts(
        scripts: Iterable<[string, ScriptFileRole]>,
    ): Promise<boolean> {
        let reindexed = false;
        for (const [uri, role] of scripts) {
            const doc = await this.deps.readDocument(uri);
            if (doc === undefined) continue;
            this.deps.indexScriptFile(doc, role);
            reindexed = true;
        }
        return reindexed;
    }

    /**
     * Sync the index to a changed script file set.
     *
     * @param previous The pre-change script files and roles.
     * @returns Whether the set's membership changed, and whether the index changed.
     */
    private async applyScriptSetChange(
        previous: Map<string, ScriptFileRole>,
    ): Promise<{ membershipChanged: boolean; indexChanged: boolean }> {
        const current = this.scriptRoles ?? new Map<string, ScriptFileRole>();
        const removed = [...previous.keys()].filter((uri) => !current.has(uri));
        const changed = [...current].filter(
            ([uri, role]) => previous.get(uri) !== role,
        );
        for (const uri of removed) this.deps.index.removeDocument(uri);
        const reindexed = await this.reindexScripts(changed);
        return {
            membershipChanged:
                removed.length > 0 ||
                changed.some(([uri]) => !previous.has(uri)),
            indexChanged: removed.length > 0 || reindexed,
        };
    }

    private scheduleFileEventFlush(): void {
        clearTimeout(this.fileEventTimer);
        this.fileEventTimer = setTimeout(
            () => void this.flushFileEvents(),
            fileEventDebounceMs,
        );
    }

    /**
     * Act on the creates and post-delete work since the last flush.
     */
    private flushFileEvents(): Promise<void> {
        this.fileEventTimer = undefined;
        const created = [...this.pendingCreates];
        this.pendingCreates.clear();
        const postDeleteWork = this.pendingPostDeleteWork;
        this.pendingPostDeleteWork = noPendingPostDeleteWork();
        if (postDeleteWork.storyData) {
            // A workspace index re-resolves, re-registers and revalidates
            // everything so we don't care if there's pending post-delete work
            this.deps.queue.indexWorkspace();
            return Promise.resolve();
        }
        return this.serialize(async () => {
            let reregister = postDeleteWork.scriptFiles;
            let revalidate = postDeleteWork.any;
            let tweeQueued = false;
            const previous = this.scriptRoles;
            if (created.length > 0 && (await this.fetchFileSets())) {
                if (previous !== undefined) {
                    const change = await this.applyScriptSetChange(previous);
                    reregister ||= change.membershipChanged;
                    revalidate ||= change.indexChanged;
                }
                for (const uri of created) {
                    if (this.isTrackedTweeFile(uri)) {
                        this.deps.queue.indexFile(uri);
                        tweeQueued = true;
                    }
                }
            }
            if (reregister) {
                this.deps.scriptFilesChanged([
                    ...(this.scriptRoles?.keys() ?? []),
                ]);
            }
            // The queue revalidates after indexing so revalidating now would
            // briefly show diagnostics from a half-applied rename
            if (revalidate && !tweeQueued) {
                await this.deps.revalidateOpenTweeDocuments();
            }
        });
    }

    /**
     * Is a file one of the Twee files we're tracking internally?
     */
    private isTrackedTweeFile(uri: string): boolean {
        return this.tweeFiles?.has(uri) ?? false;
    }

    /**
     * Make sure the file sets are known, resolving them if we haven't yet
     * (as when events arrive before the first workspace index).
     */
    private async ensureFileSets(): Promise<boolean> {
        return this.tweeFiles !== undefined || (await this.resolveFileSets());
    }

    /**
     * Ask the client for the file sets once any running resolves are done.
     */
    private resolveFileSets(): Promise<boolean> {
        return this.serialize(() => this.fetchFileSets());
    }

    /**
     * Run task serially so a slow task can't overwrite a newer but faster one.
     */
    private serialize<T>(task: () => Promise<T>): Promise<T> {
        const result = this.resolveChain.then(task);
        this.resolveChain = result.catch(() => undefined);
        return result;
    }

    /**
     * Ask the client for the file sets.
     *
     * @returns True if the reequest worked, false otherwise.
     */
    private async fetchFileSets(): Promise<boolean> {
        try {
            this.setFileSets(await this.deps.findProjectFiles());
            return true;
        } catch (err) {
            // A re-index would cause the same failing request, so skip it
            this.deps.logError(`Couldn't resolve the project's files: ${err}`);
            return false;
        }
    }
}
