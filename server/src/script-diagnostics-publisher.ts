import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { updateScriptFileIndex } from "./indexer";
import { ParseLevel } from "./parser-types";
import { ProjectIndex, ScriptFileRole } from "./project-index";

/**
 * Everything the publisher needs from the outside world.
 */
export interface ScriptDiagnosticsPublisherDeps {
    index: ProjectIndex;
    sendDiagnostics(uri: string, diagnostics: Diagnostic[]): void;
}

/**
 * Indexes `.js` script files and publishes their diagnostics.
 */
export class ScriptDiagnosticsPublisher {
    /** URIs of `.js` files whose published diagnostics aren't empty. */
    private readonly hasDiagnostics = new Set<string>();

    constructor(private readonly deps: ScriptDiagnosticsPublisherDeps) {}

    /**
     * Index a `.js` file and publish its diagnostics.
     *
     * @param doc Script file to index.
     * @param role Role the script file plays in the project.
     */
    indexScriptFile(doc: TextDocument, role: ScriptFileRole): void {
        updateScriptFileIndex(doc, role, ParseLevel.Full, this.deps.index);
        const diagnostics = [...this.deps.index.getParseErrors(doc.uri)];
        if (diagnostics.length > 0 || this.hasDiagnostics.has(doc.uri)) {
            this.deps.sendDiagnostics(doc.uri, diagnostics);
        }
        if (diagnostics.length > 0) this.hasDiagnostics.add(doc.uri);
        else this.hasDiagnostics.delete(doc.uri);
    }

    /**
     * Clear published diagnostics for `.js` files that are no longer script
     * files.
     */
    clearRemovedScriptDiagnostics(): void {
        const current = new Set(this.deps.index.getScriptFileUris());
        for (const uri of this.hasDiagnostics) {
            if (current.has(uri)) continue;
            this.deps.sendDiagnostics(uri, []);
            this.hasDiagnostics.delete(uri);
        }
    }
}
