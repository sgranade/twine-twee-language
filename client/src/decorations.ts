import * as vscode from "vscode";

import { DecorationRange, DecorationType } from "./client-server";

/**
 * Text decorations for each decoration type.
 */
const decorations: Record<DecorationType, vscode.TextEditorDecorationType> = {
    [DecorationType.ChapbookModifierContent]:
        vscode.window.createTextEditorDecorationType({
            borderWidth: "0 0 0 1px",
            borderStyle: "solid",
            borderSpacing: "0 0 0 10px",
            dark: {
                backgroundColor: "rgba(0, 0, 150, 0.2)",
                borderColor: "rgb(150, 150, 150)",
            },
            light: {
                backgroundColor: "rgba(120, 255, 255, 0.2)",
                borderColor: "rgb(50, 50, 50)",
            },
            isWholeLine: true,
        }),
};

const currentRanges: Record<DecorationType, vscode.Range[]> = {
    [DecorationType.ChapbookModifierContent]: [],
};

/**
 * Set the decoration ranges for the current editor.
 *
 * @param ranges Decoration ranges for the current editor.
 */
export function setEditorDecorationRanges(ranges: DecorationRange[]): void {
    for (const type of Object.keys(DecorationType).filter(
        (k) => !isNaN(Number(k))
    )) {
        currentRanges[type].length = 0;
    }
    for (const range of ranges) {
        currentRanges[range.type].push(
            new vscode.Range(
                range.range.start.line,
                range.range.start.character,
                range.range.end.line,
                range.range.end.character
            )
        );
    }
}

/**
 * Update the decoration in an editor.
 *
 * @param editor Editor to update the decoration in.
 */
export function updateDecoration(editor: vscode.TextEditor): void {
    const cursorPosition = editor.selection.active;
    // If these searches end up being a bottleneck, consider switching to interval trees
    for (const [type, ranges] of Object.entries(currentRanges)) {
        const containingRanges = ranges.filter((r) =>
            r.contains(cursorPosition)
        );
        editor.setDecorations(decorations[type], containingRanges);
    }
}
