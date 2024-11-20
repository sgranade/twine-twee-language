import * as vscode from "vscode";
import { Utils as UriUtils } from "vscode-uri";

import { build } from "./build-system";
import { VSCodeWorkspaceProvider } from "./vscode-workspace-provider";

type BuildFlags = "test" | "watch";

/**
 * Task definition for Twine build tasks.
 */
interface TwineBuildTaskDefinition extends vscode.TaskDefinition {
    /**
     * Build flags, such as "test" or "watch".
     */
    flags: BuildFlags[];
}

/**
 * Task provider for Twine tasks.
 */
export class TwineTaskProvider implements vscode.TaskProvider {
    static TwineBuildScriptType = "twine";
    private tasks: vscode.Task[] | undefined;

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const flags: BuildFlags[] = _task.definition.flags;
        if (flags !== undefined) {
            return this.getTask(flags);
        }
        return undefined;
    }

    private getTasks(): vscode.Task[] {
        if (this.tasks === undefined) {
            this.tasks = [
                this.getTask([]),
                this.getTask(["test"]),
                this.getTask(["watch"]),
                this.getTask(["test", "watch"]),
            ];
        }
        return this.tasks;
    }

    private getTask(flags: BuildFlags[]): vscode.Task {
        const definition: TwineBuildTaskDefinition = {
            type: TwineTaskProvider.TwineBuildScriptType,
            flags,
        };
        return new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            `${flags.includes("watch") ? "Watch" : "Build"}${flags.includes("test") ? " (test mode)" : ""}`,
            TwineTaskProvider.TwineBuildScriptType,
            new vscode.CustomExecution(
                async (): Promise<vscode.Pseudoterminal> => {
                    // When the task is executed, set up the pseudoterminal
                    return new TwineTaskTerminal(flags);
                }
            )
        );
    }
}

class TwineTaskTerminal implements vscode.Pseudoterminal {
    private writeEmitter = new vscode.EventEmitter<string>();
    onDidWrite: vscode.Event<string> = this.writeEmitter.event;
    private closeEmitter = new vscode.EventEmitter<number>();
    onDidClose?: vscode.Event<number> = this.closeEmitter.event;

    private fileWatcher: vscode.FileSystemWatcher | undefined;

    constructor(private flags: BuildFlags[]) {}

    open(): void {
        if (this.flags.includes("watch")) {
            this.fileWatcher = vscode.workspace.createFileSystemWatcher(
                new vscode.RelativePattern(
                    vscode.workspace.workspaceFolders[0],
                    "**/*.{twee, tw}"
                )
            );
            this.fileWatcher.onDidChange((uri) => this.doBuild(uri));
            this.fileWatcher.onDidCreate((uri) => this.doBuild(uri));
            this.fileWatcher.onDidDelete((uri) => this.doBuild(uri));
        }
        this.doBuild();
    }

    close(): void {
        if (this.fileWatcher) {
            this.fileWatcher.dispose();
        }
    }

    private building: boolean = false;
    private buildRequested: boolean = false;

    private async doBuild(uri?: vscode.Uri): Promise<void> {
        this.buildRequested = true;
        // Don't have dueling builds
        if (this.building) {
            return;
        }
        return new Promise<void>(async (resolve) => {
            if (uri !== undefined) {
                this.writeEmitter.fire(
                    `\r\nFile changed: ${UriUtils.basename(uri)}\r\n`
                );
            }
            try {
                this.building = true;
                while (this.buildRequested) {
                    this.buildRequested = false;
                    this.writeEmitter.fire("Starting build...\r\n");
                    const isTest = this.flags.includes("test");
                    await build(
                        isTest ? { debug: true } : {},
                        new VSCodeWorkspaceProvider()
                    );
                    this.writeEmitter.fire("Build complete.\r\n");
                    if (!this.flags.includes("watch")) {
                        this.closeEmitter.fire(0);
                        resolve();
                    }
                }
            } finally {
                this.building = false;
            }
        });
    }
}
