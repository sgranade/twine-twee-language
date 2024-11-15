import * as vscode from "vscode";

import { build } from "./build-system";
import { WorkspaceProvider } from "./workspace-provider";

/**
 * Task definition for Twine build tasks.
 */
interface TwineBuildTaskDefinition extends vscode.TaskDefinition {
    /**
     * Whether we're building in test mode.
     */
    test: boolean;
}

/**
 * Task provider for Twine tasks.
 */
export class TwineTaskProvider implements vscode.TaskProvider {
    static TwineBuildScriptType = "twine";
    private tasks: vscode.Task[] | undefined;

    constructor(private workspaceProvider: WorkspaceProvider) {}

    public async provideTasks(): Promise<vscode.Task[]> {
        return this.getTasks();
    }

    public resolveTask(_task: vscode.Task): vscode.Task | undefined {
        const test: boolean = _task.definition.test;
        if (test !== undefined) {
            return this.getTask(test);
        }
        return undefined;
    }

    private getTasks(): vscode.Task[] {
        if (this.tasks === undefined) {
            this.tasks = [this.getTask(true), this.getTask(false)];
        }
        return this.tasks;
    }

    private getTask(test: boolean): vscode.Task {
        const definition: TwineBuildTaskDefinition = {
            type: TwineTaskProvider.TwineBuildScriptType,
            test,
        };
        return new vscode.Task(
            definition,
            vscode.TaskScope.Workspace,
            `Build${test ? " (test mode)" : ""}`,
            TwineTaskProvider.TwineBuildScriptType,
            new vscode.CustomExecution(
                async (): Promise<vscode.Pseudoterminal> => {
                    // When the task is executed, set up the pseudoterminal
                    return new TwineTaskTerminal(this.workspaceProvider, test);
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

    constructor(
        private workspaceProvider: WorkspaceProvider,
        private test: boolean
    ) {}

    open(): void {
        this.doBuild();
    }

    close(): void {}

    private async doBuild(): Promise<void> {
        return new Promise<void>(async (resolve) => {
            this.writeEmitter.fire("Starting build...\r\n");
            await build(
                this.test ? { debug: true } : {},
                this.workspaceProvider
            );
            this.writeEmitter.fire("Build complete.\r\n\r\n");
            resolve();
        });
    }
}
