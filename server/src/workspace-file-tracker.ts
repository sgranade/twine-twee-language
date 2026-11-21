import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectFiles } from "@tt3/shared";
import { IndexingQueue } from "./indexing-queue";
import { Index, ScriptFileRole } from "./project-index";

/** How long to wait after the last `.js` edit before re-parsing. */
export const scriptReparseDebounceMs = 300;

/** How long to wait after the last edit to a file in a project set before re-updating the file set. */
export const fileSetResolveDebounceMs = 300;

/**
 * Everything the tracker needs from the outside world.
 */
export interface WorkspaceFileTrackerDeps {
    index: Pick<
        Index,
        "getScriptFileRole" | "getStoryDataUri" | "removeDocument"
    >;
    queue: Pick<IndexingQueue, "indexFile" | "indexWorkspace">;
    /** Ask the client for the project's resolved file sets. */
    findProjectFiles(): Promise<ProjectFiles>;
    /** Does the editor have the document open? */
    isOpen(uri: string): boolean;
    parseMacroFile(uri: string): Promise<void>;
    onMacroChanges(): void;
    logError(message: string): void;
    indexScriptFile(document: TextDocument, role: ScriptFileRole): void;
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
 * Handles watched-file events plus open-buffer edits.
 */
export class WorkspaceFileTracker {
    private pendingScripts = new Map<string, TextDocument>();
    private scriptTimer: ReturnType<typeof setTimeout> | undefined;
    private tweeFiles: Set<string> | undefined;
    private pendingCreates = new Set<string>();
    private createTimer: ReturnType<typeof setTimeout> | undefined;
    private resolveChain: Promise<unknown> = Promise.resolve();

    constructor(private readonly deps: WorkspaceFileTrackerDeps) {}

    /**
     * Handle a change to a script file
     */
    handleScriptFileChanged(document: TextDocument): void {
        // Queue the script to be parsed (queued to debounce rapid edits)
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
            const role = this.deps.index.getScriptFileRole(doc.uri);
            if (role !== undefined) {
                this.deps.indexScriptFile(doc, role);
            }
        }
        // Once we've resolved them all, revalidate open Twee docs since the script might have changed vars
        void this.deps.revalidateOpenTweeDocuments();
    }

    /**
     * Update resolved file sets from project files.
     */
    setFileSets(files: ProjectFiles): void {
        this.tweeFiles = new Set(files.tweeFiles);
    }

    /**
     * Handle watched-file change events.
     */
    async handleWatchedFileChanges(
        changes: WatchedFileChange[],
    ): Promise<void> {
        const tweeChanges: WatchedFileChange[] = [];
        for (const change of changes) {
            // Is this a config file change?
            if (/\.twee-config\.(json|ya?ml)$/.test(change.uri)) {
                void this.deps.parseMacroFile(change.uri);
                this.deps.onMacroChanges();
            } else if (change.kind === "created") {
                this.handleCreated(change.uri);
            } else {
                tweeChanges.push(change); // We'll handle them in a sec
            }
        }

        if (tweeChanges.length === 0) return;
        if (!(await this.ensureFileSets())) return;

        for (const change of tweeChanges) {
            if (!this.isTrackedTweeFile(change.uri)) continue;
            if (change.kind === "deleted") {
                await this.handleTweeDeleted(change.uri);
            } else if (!this.deps.isOpen(change.uri)) {
                this.deps.queue.indexFile(change.uri);
            }
        }
    }

    /**
     * Handle a closed document.
     */
    async handleDocumentClosed(uri: string): Promise<void> {
        if (!(await this.ensureFileSets())) return;
        // Re-read a closed Twee file from disk to get rid of unsaved edits
        if (this.isTrackedTweeFile(uri)) {
            this.deps.queue.indexFile(uri);
        }
    }

    /**
     * Handle a newly-created document.
     */
    private handleCreated(uri: string): void {
        this.pendingCreates.add(uri);
        clearTimeout(this.createTimer);
        this.createTimer = setTimeout(
            () => void this.indexPendingCreates(),
            fileSetResolveDebounceMs,
        );
    }

    /**
     * Index pending created files.
     */
    private async indexPendingCreates(): Promise<void> {
        this.createTimer = undefined;
        const created = [...this.pendingCreates];
        this.pendingCreates.clear();
        if (!(await this.resolveFileSets())) return;
        for (const uri of created) {
            if (this.isTrackedTweeFile(uri)) {
                this.deps.queue.indexFile(uri);
            }
        }
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
     * Ask the client for the file sets.
     *
     * If it fails, log and drop the event.
     */
    private resolveFileSets(): Promise<boolean> {
        // Run resolves serially so a slow one doesn't overwrite a newer result
        const result = this.resolveChain.then(async () => {
            try {
                this.setFileSets(await this.deps.findProjectFiles());
                return true;
            } catch (err) {
                this.deps.logError(
                    `Couldn't resolve the project's files: ${err}`,
                );
                return false;
            }
        });
        this.resolveChain = result;
        return result;
    }

    /**
     * Handle a deleted Twee file.
     */
    private async handleTweeDeleted(uri: string): Promise<void> {
        this.tweeFiles?.delete(uri);
        const deletedFileHeldStoryData =
            this.deps.index.getStoryDataUri() === uri;
        this.deps.index.removeDocument(uri);
        if (deletedFileHeldStoryData) {
            this.deps.queue.indexWorkspace();
        } else {
            await this.deps.revalidateOpenTweeDocuments();
        }
    }
}
