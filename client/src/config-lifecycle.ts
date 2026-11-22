import { ConfigFilename, resetConfig, updateConfigFromJson } from "./config";

/**
 * How long to wait after the last config file event before reloading.
 */
export const ConfigReloadDelayMs = 300;

export interface ConfigFileDeps {
    /**
     * Read the config file's contents.
     *
     * @returns The contents, or undefined if the file doesn't exist.
     * @throws Error if the file exists but can't be read.
     */
    readConfigFile: () => Promise<string | undefined>;
    /** Show an error message to the user. */
    showError: (message: string) => void;
}

/**
 * Update the project's configuration from the configuration file.
 *
 * @returns True if the config file was found; false otherwise.
 */
export async function loadConfigFile(deps: ConfigFileDeps): Promise<boolean> {
    let contents: string | undefined;
    try {
        contents = await deps.readConfigFile();
    } catch (e) {
        deps.showError(
            `There are issues with ${ConfigFilename}:\n${(e as Error).message}`,
        );
        return true;
    }
    if (contents === undefined) return false;

    const configError = updateConfigFromJson(contents);
    if (configError) {
        deps.showError(
            `There are issues with ${ConfigFilename}:\n${configError}`,
        );
    } else {
        // TODO If disabled diagnostics have changed, let the server know
    }
    return true;
}

type Listen = (listener: () => unknown) => { dispose(): unknown };

/**
 * The parts of a file system watcher on the config file that we care about.
 */
export interface ConfigFileWatcher {
    onDidCreate: Listen;
    onDidChange: Listen;
    onDidDelete: Listen;
}

export interface ConfigReloaderDeps extends ConfigFileDeps {
    /** Ask the server to reindex. */
    requestReindex: () => void;
}

/**
 * Reload the config whenever the config file is created, changed, or deleted.
 *
 * @param watcher Config file Watcher.
 * @param deps Dependencies.
 * @returns Disposable that stops watching.
 */
export function watchConfigFile(
    watcher: ConfigFileWatcher,
    deps: ConfigReloaderDeps,
): { dispose(): void } {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let reloading = false; // Are we reloading?
    let reloadAgain = false; // Do we need to reload again?
    let disposed = false;

    async function reload() {
        if (reloading) {
            reloadAgain = true;
            return;
        }
        reloading = true;
        try {
            do {
                reloadAgain = false;
                if (!(await loadConfigFile(deps))) {
                    resetConfig();
                }
            } while (reloadAgain && !disposed);
            if (!disposed) deps.requestReindex();
        } finally {
            reloading = false;
        }
    }

    function trigger() {
        if (timer !== undefined) clearTimeout(timer);
        timer = setTimeout(() => {
            timer = undefined;
            void reload();
        }, ConfigReloadDelayMs);
    }

    const subscriptions = [
        watcher.onDidCreate(trigger),
        watcher.onDidChange(trigger),
        watcher.onDidDelete(trigger),
    ];

    return {
        dispose() {
            disposed = true;
            if (timer !== undefined) clearTimeout(timer);
            timer = undefined;
            for (const s of subscriptions) s.dispose();
        },
    };
}
