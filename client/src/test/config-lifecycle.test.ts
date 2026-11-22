import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";

import { currentConfig, resetConfig, updateConfigFromJson } from "../config";
import * as uut from "../config-lifecycle";

type Event = "create" | "change" | "delete";

function buildWatcher() {
    const listeners: Record<Event, (() => unknown)[]> = {
        create: [],
        change: [],
        delete: [],
    };
    const listen = (event: Event) => (listener: () => unknown) => {
        listeners[event].push(listener);
        return {
            dispose: () => {
                listeners[event] = listeners[event].filter(
                    (l) => l !== listener,
                );
            },
        };
    };
    return {
        watcher: {
            onDidCreate: listen("create"),
            onDidChange: listen("change"),
            onDidDelete: listen("delete"),
        },
        fire: (event: Event) => listeners[event].forEach((l) => l()),
    };
}

function buildDeps(contents: string | undefined) {
    const deps = {
        contents,
        readError: undefined as Error | undefined,
        reads: 0,
        errors: [] as string[],
        reindexes: 0,
        readConfigFile: async () => {
            deps.reads++;
            if (deps.readError) throw deps.readError;
            return deps.contents;
        },
        showError: (message: string) => deps.errors.push(message),
        requestReindex: () => deps.reindexes++,
    };
    return deps;
}

describe("Config Lifecycle", () => {
    beforeEach(() => {
        resetConfig();
    });

    describe("Load Config File", () => {
        it("should apply a valid file and report that it exists", async () => {
            const deps = buildDeps('{"build":{"outputPath":"out"}}');

            const result = await uut.loadConfigFile(deps);

            expect(result).to.be.true;
            expect(currentConfig.build.outputPath).to.equal("out");
            expect(deps.errors).to.be.empty;
        });

        it("should keep the last good config and show an error for an invalid file", async () => {
            updateConfigFromJson('{"build":{"outputPath":"good"}}');
            const deps = buildDeps('{"build":{"outputPath":');

            const result = await uut.loadConfigFile(deps);

            expect(result).to.be.true;
            expect(currentConfig.build.outputPath).to.equal("good");
            expect(deps.errors).to.have.length(1);
            expect(deps.errors[0]).to.include("tt3.config.json");
        });

        it("should keep the last good config and show an error for an unreadable file", async () => {
            updateConfigFromJson('{"build":{"outputPath":"good"}}');
            const deps = buildDeps(undefined);
            deps.readError = new Error("permission denied");

            const result = await uut.loadConfigFile(deps);

            expect(result).to.be.true;
            expect(currentConfig.build.outputPath).to.equal("good");
            expect(deps.errors[0]).to.include("permission denied");
        });

        it("should report a missing file without changing the config", async () => {
            updateConfigFromJson('{"build":{"outputPath":"good"}}');
            const deps = buildDeps(undefined);

            const result = await uut.loadConfigFile(deps);

            expect(result).to.be.false;
            expect(currentConfig.build.outputPath).to.equal("good");
            expect(deps.errors).to.be.empty;
        });
    });

    describe("Watch Config File", () => {
        let clock: sinon.SinonFakeTimers;

        beforeEach(() => {
            clock = sinon.useFakeTimers();
        });

        afterEach(() => {
            clock.restore();
        });

        it("should load the file and reindex when the file is created", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps('{"build":{"outputPath":"out"}}');
            uut.watchConfigFile(watcher, deps);

            fire("create");
            await clock.tickAsync(uut.ConfigReloadDelayMs);

            expect(currentConfig.build.outputPath).to.equal("out");
            expect(deps.reindexes).to.equal(1);
        });

        it("should load the file and reindex when the file is changed", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps('{"build":{"outputPath":"out"}}');
            uut.watchConfigFile(watcher, deps);

            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs);

            expect(currentConfig.build.outputPath).to.equal("out");
            expect(deps.reindexes).to.equal(1);
        });

        it("should reset to schema defaults and reindex when the file is deleted", async () => {
            updateConfigFromJson('{"build":{"outputPath":"old"}}');
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps(undefined);
            uut.watchConfigFile(watcher, deps);

            fire("delete");
            await clock.tickAsync(uut.ConfigReloadDelayMs);

            expect(currentConfig.build.outputPath).to.equal("build");
            expect(deps.reindexes).to.equal(1);
        });

        it("should keep the last good config, show the error, and reindex when the file becomes invalid", async () => {
            updateConfigFromJson('{"build":{"outputPath":"good"}}');
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps("{");
            uut.watchConfigFile(watcher, deps);

            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs);

            expect(currentConfig.build.outputPath).to.equal("good");
            expect(deps.errors).to.have.length(1);
            expect(deps.reindexes).to.equal(1);
        });

        it("should do nothing before the debounce delay elapses", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps("{}");
            uut.watchConfigFile(watcher, deps);

            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs - 1);

            expect(deps.reads).to.equal(0);
            expect(deps.reindexes).to.equal(0);
        });

        it("should reload and reindex exactly once for a burst of events", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps("{}");
            uut.watchConfigFile(watcher, deps);

            fire("delete");
            await clock.tickAsync(uut.ConfigReloadDelayMs - 1);
            fire("create");
            await clock.tickAsync(uut.ConfigReloadDelayMs - 1);
            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs * 10);

            expect(deps.reads).to.equal(1);
            expect(deps.reindexes).to.equal(1);
        });

        it("should reload again but reindex once when an event arrives mid-reload", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps('{"build":{"outputPath":"first"}}');
            let finishFirstRead: () => void = () => {};
            const fastRead = deps.readConfigFile;
            deps.readConfigFile = async () => {
                if (deps.reads === 0) {
                    const contents = deps.contents;
                    deps.reads++;
                    await new Promise<void>((r) => (finishFirstRead = r));
                    return contents;
                }
                return fastRead();
            };
            uut.watchConfigFile(watcher, deps);

            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs);
            deps.contents = '{"build":{"outputPath":"second"}}';
            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs);
            finishFirstRead();
            await clock.tickAsync(uut.ConfigReloadDelayMs * 10);

            expect(deps.reads).to.equal(2);
            expect(deps.reindexes).to.equal(1);
            expect(currentConfig.build.outputPath).to.equal("second");
        });

        it("should stop reacting to events once disposed", async () => {
            const { watcher, fire } = buildWatcher();
            const deps = buildDeps("{}");
            const reloader = uut.watchConfigFile(watcher, deps);

            fire("change");
            reloader.dispose();
            fire("change");
            await clock.tickAsync(uut.ConfigReloadDelayMs * 10);

            expect(deps.reads).to.equal(0);
            expect(deps.reindexes).to.equal(0);
        });
    });
});
