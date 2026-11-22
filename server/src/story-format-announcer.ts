import { StoryFormat, storyFormatsDiffer } from "@tt3/shared";

/** How long to wait after the last story format edit before reacting to it. */
export const storyFormatEditDebounceMs = 300;

/**
 * Everything the announcer needs from the outside world.
 */
export interface StoryFormatAnnouncerDeps {
    /** The project's current story format. */
    getStoryFormat(): StoryFormat | undefined;
    /** React to a changed story format. */
    announce(format: StoryFormat): void;
    /** Request a full workspace reindex. */
    reindexWorkspace(): void;
}

/**
 * Announces story format changes.
 */
export class StoryFormatAnnouncer {
    private lastAnnounced: StoryFormat | undefined;
    private editTimer: ReturnType<typeof setTimeout> | undefined;

    constructor(private readonly deps: StoryFormatAnnouncerDeps) {}

    /**
     * The format was edited, requiring an announcement of the current format
     * and a re-index after a debounce.
     */
    formatEdited(): void {
        clearTimeout(this.editTimer);
        this.editTimer = setTimeout(
            () => this.flushEdits(),
            storyFormatEditDebounceMs,
        );
    }

    private flushEdits(): void {
        this.editTimer = undefined;
        const format = this.deps.getStoryFormat();
        if (!format?.format || !storyFormatsDiffer(format, this.lastAnnounced))
            return;
        this.announceNow(format);
        this.deps.reindexWorkspace();
    }

    /**
     * Announce a changed story format immediately.
     *
     * Announced whether or not the format changes.
     */
    announceNow(format: StoryFormat): void {
        this.lastAnnounced = format;
        this.deps.announce(format);
    }
}
