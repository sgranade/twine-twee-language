import {
    DefinitionRequest,
    DidChangeTextDocumentNotification,
    DidCloseTextDocumentNotification,
    DidOpenTextDocumentNotification,
    Disposable,
    ReferencesRequest,
    RemoteClient,
    RenameRequest,
    TextDocumentFilter,
    TextDocumentSyncKind,
} from "vscode-languageserver/node";

/**
 * Escape glob metacharacters in a literal path so it matches only itself.
 */
export function escapeGlob(path: string): string {
    return path.replace(/[*?[{}]/g, (c) => `[${c}]`);
}

/**
 * Build document selector matching the given `file:` script URIs.
 *
 * @param uris URIs of the resolved script files.
 * @returns Document filters that match those script files.
 */
export function buildScriptFileSelector(
    uris: readonly string[],
): TextDocumentFilter[] {
    const filters: TextDocumentFilter[] = [];
    for (const uri of uris) {
        if (!uri.startsWith("file:")) continue;
        // Each file is a pattern relative to its folder, so the client resolves the
        // folder's platform path (drive letters, separators, case) itself
        const slash = uri.lastIndexOf("/");
        let name: string;
        try {
            name = decodeURIComponent(uri.slice(slash + 1));
        } catch {
            continue;
        }
        filters.push({
            scheme: "file",
            pattern: {
                baseUri: uri.slice(0, slash),
                pattern: escapeGlob(name),
            },
        });
    }
    return filters;
}

/**
 * What the registrar needs from the outside world.
 */
export interface ScriptFeatureRegistrarDeps {
    client: Pick<RemoteClient, "register">;
    prepareProvider: boolean; // Does the client support `prepareRename`?
    logError(message: string): void;
}

/**
 * Registers text sync, references, definition and rename for the
 * project `.js` files and no others, re-registering whenever that set changes.
 */
export class ScriptFeatureRegistrar {
    private registrations: Disposable[] = [];
    private lastFiltersJson = "";
    private pending: Promise<void> = Promise.resolve();

    constructor(private readonly deps: ScriptFeatureRegistrarDeps) {}

    /**
     * Register features for the given script files.
     *
     * @param uris URIs of the project script files.
     */
    update(uris: readonly string[]): Promise<void> {
        this.pending = this.pending.then(() => this.apply(uris));
        return this.pending;
    }

    private async apply(uris: readonly string[]): Promise<void> {
        const filters = buildScriptFileSelector(uris);
        const filtersJson = JSON.stringify(filters);
        if (filtersJson === this.lastFiltersJson) return;
        await this.disposeAll(this.registrations);
        this.registrations = [];
        this.lastFiltersJson = filtersJson;
        if (filters.length === 0) return;

        const { client } = this.deps;
        const options = { documentSelector: filters };
        const results = await Promise.allSettled([
            client.register(DidOpenTextDocumentNotification.type, options),
            client.register(DidChangeTextDocumentNotification.type, {
                ...options,
                syncKind: TextDocumentSyncKind.Full,
            }),
            client.register(DidCloseTextDocumentNotification.type, options),
            client.register(ReferencesRequest.type, options),
            client.register(DefinitionRequest.type, options),
            client.register(RenameRequest.type, {
                ...options,
                prepareProvider: this.deps.prepareProvider,
            }),
        ]);
        const registered: Disposable[] = [];
        const failures: unknown[] = [];
        for (const result of results) {
            if (result.status === "fulfilled") registered.push(result.value);
            else failures.push(result.reason);
        }
        if (failures.length > 0) {
            // Leave nothing half-registered
            await this.disposeAll(registered);
            this.lastFiltersJson = "";
            this.deps.logError(
                `Couldn't register .js features: ${failures.join("; ")}`,
            );
            return;
        }
        this.registrations = registered;
    }

    private async disposeAll(registrations: Disposable[]): Promise<void> {
        for (const reg of registrations) {
            reg.dispose();
        }
    }
}
