import * as vscode from "vscode";

import { CustomCommands } from "./constants";
import { codesToDisableGlobally } from "./global-disable";

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

        for (const code of codesToDisableGlobally(context.diagnostics)) {
            const action = new vscode.CodeAction(
                `Disable ${code} globally`,
                vscode.CodeActionKind.QuickFix,
            );
            action.command = {
                command: CustomCommands.DisableDiagnosticGlobally,
                title: `Disable ${code} globally`,
                arguments: [code],
            };
            // Don't attach the diagnostic to it or else it'll show above
            // the language servers' diagnostic-specific quick actions
            actions.push(action);
        }

        return actions;
    }
}
