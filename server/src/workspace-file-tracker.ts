import { isTweeFile } from "@tt3/shared";
import { IndexingQueue } from "./indexing-queue";
import { Index } from "./project-index";

/**
 * Everything the tracker needs from the outside world.
 */
export interface WorkspaceFileTrackerDeps {
    index: Pick<Index, "removeDocument" | "renameDocument">;
    queue: Pick<IndexingQueue, "indexFile">;
    processAllOpenDocuments(): Promise<void>;
    parseMacroFile(uri: string): Promise<void>;
    onMacroChanges(): void;
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
    constructor(private readonly deps: WorkspaceFileTrackerDeps) {}

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
