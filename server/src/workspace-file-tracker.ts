import { TextDocument } from "vscode-languageserver-textdocument";

import { isTweeFile } from "@tt3/shared";
import { IndexingQueue } from "./indexing-queue";
import { Index, ScriptFileRole } from "./project-index";

/** How long to wait after the last `.js` edit before re-parsing. */
export const scriptReparseDebounceMs = 300;

/**
 * Everything the tracker needs from the outside world.
 */
export interface WorkspaceFileTrackerDeps {
    index: Pick<
        Index,
        "removeDocument" | "renameDocument" | "getScriptFileRole"
    >;
    queue: Pick<IndexingQueue, "indexFile">;
    processAllOpenDocuments(): Promise<void>;
    parseMacroFile(uri: string): Promise<void>;
    onMacroChanges(): void;
    indexScriptFile(document: TextDocument, role: ScriptFileRole): void;
    revalidateOpenTweeDocuments(): Promise<void>;
}

/**
 * Whether a watched file was deleted, as opposed to created or changed.
 */
export interface WatchedFileChange {
    uri: string;
    deleted: boolean;
}

/**
 * Handles watched-file and file-operation events.
 */
export class WorkspaceFileTracker {
    private pendingScripts = new Map<string, TextDocument>();
    private scriptTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly deps: WorkspaceFileTrackerDeps) {}

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
     * Index every pending `.js` buffer, then revalidate open Twee documents.
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
        void this.deps.revalidateOpenTweeDocuments();
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
                this.deps.queue.indexFile(uri);
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
}
