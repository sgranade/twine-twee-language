import * as vscode from "vscode";

import { CustomCommands } from "./constants";

/**
 * Code action provider to disable diagnostics globally.
 */
export class DisableDiagnosticCodeActionProvider
    implements vscode.CodeActionProvider
{
    provideCodeActions(
        _document: vscode.TextDocument,
        _range: vscode.Range,
        context: vscode.CodeActionContext,
    ): vscode.CodeAction[] {
        const actions: vscode.CodeAction[] = [];

        for (const diagnostic of context.diagnostics) {
            if (typeof diagnostic.code === "string") {
                const action = new vscode.CodeAction(
                    `Disable ${diagnostic.code} globally`,
                    vscode.CodeActionKind.QuickFix,
                );
                action.command = {
                    command: CustomCommands.DisableDiagnosticGlobally,
                    title: `Disable ${diagnostic.code} globally`,
                    arguments: [diagnostic.code],
                };
                // Don't attach the diagnostic to it or else it'll show above
                // the language servers' diagnostic-specific quick actions
                actions.push(action);
            }
        }

        return actions;
    }
}
