import * as vscode from "vscode";

const annotationDecoration = vscode.window.createTextEditorDecorationType({
    after: {
        margin: "0 0 0 3em",
        textDecoration: "none",
    },
    rangeBehavior: vscode.DecorationRangeBehavior.ClosedOpen,
});
let editor: vscode.TextEditor;

/**
 * Add a single trailing annotation to an editor.
 *
 * Note that this function assumes there will only ever be one active annotation in an editor,
 * and that annotation is non-persistent.
 *
 * @param ed Editor to add the annotation to.
 * @param line 0-based line to add the trailing annotation.
 * @param message Annotation message.
 */
export function addTrailingAnnotation(
    ed: vscode.TextEditor,
    line: number,
    message: string
): void {
    clearAnnotations();
    if (ed.document === null) {
        return;
    }
    editor = ed;
    const decorationRange = ed.document.validateRange(
        new vscode.Range(
            line,
            Number.MAX_SAFE_INTEGER,
            line,
            Number.MAX_SAFE_INTEGER
        )
    );
    ed.setDecorations(annotationDecoration, [
        {
            range: decorationRange,
            renderOptions: {
                after: {
                    contentText: message,
                    fontStyle: "italic",
                    color: new vscode.ThemeColor("errorForeground"),
                },
            },
        },
    ]);
}

/**
 * Clear all annotations.
 */
export function clearAnnotations() {
    editor?.setDecorations(annotationDecoration, []);
    editor = undefined;
}

/**
 * Callback to remove annotations if the annotated document changes.
 *
 * @param e Text document change event.
 */
export function clearAnnotationOnChangeEvent(
    e: vscode.TextDocumentChangeEvent
) {
    if (e.document.uri.toString() === editor.document.uri.toString()) {
        clearAnnotations();
    }
}
