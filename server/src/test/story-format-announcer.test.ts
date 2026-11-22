import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";

import { StoryFormat } from "@tt3/shared";
import {
    StoryFormatAnnouncer,
    storyFormatEditDebounceMs,
} from "../story-format-announcer";

let fakeClock: sinon.SinonFakeTimers;

function harness() {
    const h = {
        current: undefined as StoryFormat | undefined,
        announced: [] as StoryFormat[],
        reindexes: 0,
        announcer: undefined as unknown as StoryFormatAnnouncer,
        edit(format: StoryFormat | undefined) {
            h.current = format;
            h.announcer.formatEdited();
        },
    };
    h.announcer = new StoryFormatAnnouncer({
        getStoryFormat: () => h.current,
        announce: (format) => h.announced.push(format),
        reindexWorkspace: () => h.reindexes++,
    });
    return h;
}

describe("Story Format Announcer", () => {
    beforeEach(() => {
        fakeClock = sinon.useFakeTimers();
    });

    afterEach(() => {
        fakeClock.restore();
    });

    it("should announce once and reindex once for the final format after a burst of edits", () => {
        const h = harness();

        h.edit({ format: "SugarCube", formatVersion: "2.3" });
        fakeClock.tick(storyFormatEditDebounceMs - 1);
        h.edit({ format: "SugarCube", formatVersion: "2.36" });
        fakeClock.tick(storyFormatEditDebounceMs - 1);
        h.edit({ format: "SugarCube", formatVersion: "2.36.1" });
        fakeClock.tick(storyFormatEditDebounceMs);

        expect(h.announced).to.eql([
            { format: "SugarCube", formatVersion: "2.36.1" },
        ]);
        expect(h.reindexes).to.equal(1);
    });

    it("should do nothing when an edit burst ends on the format that was already announced", () => {
        const h = harness();
        h.edit({ format: "SugarCube", formatVersion: "2.36.1" });
        fakeClock.tick(storyFormatEditDebounceMs);
        h.announced = [];
        h.reindexes = 0;

        h.edit({ format: "SugarCube", formatVersion: "2.36" });
        fakeClock.tick(storyFormatEditDebounceMs - 1);
        h.edit({ format: "SugarCube", formatVersion: "2.36.1" });
        fakeClock.tick(storyFormatEditDebounceMs);

        expect(h.announced).to.be.empty;
        expect(h.reindexes).to.equal(0);
    });

    it("should not re-announce when an edit only changes the format name's case", () => {
        const h = harness();
        h.edit({ format: "Sugarcube", formatVersion: "2.36.1" });
        fakeClock.tick(storyFormatEditDebounceMs);
        h.announced = [];
        h.reindexes = 0;

        h.edit({ format: "SugarCube", formatVersion: "2.36.1" });
        fakeClock.tick(storyFormatEditDebounceMs);

        expect(h.announced).to.be.empty;
        expect(h.reindexes).to.equal(0);
    });

    it("should announce a format found during a workspace index at once", () => {
        const h = harness();

        h.announcer.announceNow({ format: "Chapbook", formatVersion: "2.2.0" });

        expect(h.announced).to.eql([
            { format: "Chapbook", formatVersion: "2.2.0" },
        ]);
        expect(h.reindexes).to.equal(0);
    });

    it("should not re-announce after an edit burst ends on a format a workspace index announced", () => {
        const h = harness();
        h.edit({ format: "Chapbook", formatVersion: "2.2.0" });
        h.announcer.announceNow({ format: "Chapbook", formatVersion: "2.2.0" });
        h.announced = [];

        fakeClock.tick(storyFormatEditDebounceMs);

        expect(h.announced).to.be.empty;
        expect(h.reindexes).to.equal(0);
    });
});
