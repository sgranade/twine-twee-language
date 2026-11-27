import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    Position,
    TextEdit,
} from "vscode-languageserver";

import { DisableDiagnosticTag, isTwineDiagnostic } from "@tt3/shared";
import { Passage, ProjectIndex } from "./project-index";
import { Label } from "./types";

/**
 * Generate a position at the end of a label.
 */
function positionAfterLabel(label: Label): Position {
    return Position.create(
        label.location.range.end.line,
        label.location.range.end.character,
    );
}

/**
 * Generate diagnostic-disabling actions for a passage
 * .
 * @param uri Document URI.
 * @param passage Passage that contains the diagnostics.
 * @param diagnostics Diagnostics from that passage.
 * @returns Code actions.
 */
function generateCodeActions(
    uri: string,
    passage: Passage,
    diagnostics: Diagnostic[],
): CodeAction[] {
    const actions: CodeAction[] = [];

    // We generate diagnostic-disabling actions
    let tagAction: "create" | "add-both" | "add-one" | "update";
    let insertPos: Position;

    if (passage.tags === undefined) {
        tagAction = "create";
        insertPos = positionAfterLabel(passage.name);
    } else {
        const ndx = (passage.tags ?? []).findIndex(
            (t) => t.contents === DisableDiagnosticTag,
        );
        if (ndx === -1) {
            tagAction = "add-both";
            insertPos = positionAfterLabel(
                passage.tags[passage.tags.length - 1],
            );
        } else if (ndx === passage.tags.length - 1) {
            tagAction = "add-one";
            insertPos = positionAfterLabel(passage.tags[ndx]);
        } else {
            tagAction = "update";
            insertPos = positionAfterLabel(passage.tags[ndx + 1]);
        }
    }

    for (const d of diagnostics.filter(isTwineDiagnostic)) {
        let editText: string;
        if (tagAction === "create") {
            editText = ` [${DisableDiagnosticTag} ${d.code}]`;
        } else if (tagAction === "add-both") {
            editText = ` ${DisableDiagnosticTag} ${d.code}`;
        } else if (tagAction === "add-one") {
            editText = ` ${d.code}`;
        } else {
            editText = `,${d.code}`;
        }

        const action = CodeAction.create(
            `Disable ${d.code} for this passage`,
            {
                changes: { [uri]: [TextEdit.insert(insertPos, editText)] },
            },
            CodeActionKind.QuickFix,
        );
        // Make this action the preferred one over any client extension's
        action.isPreferred = true;
        actions.push(action);
    }

    return actions;
}

/**
 * Generate code actions for diagnostics at a position in a document.
 *
 * @param uri Document URI.
 * @param position Position the actions were requested at.
 * @param diagnostics Diagnostics at that position.
 * @param projectIndex Project index.
 * @returns Code actions.
 */
export function getCodeActionsAt(
    uri: string,
    position: Position,
    diagnostics: Diagnostic[],
    projectIndex: ProjectIndex,
): CodeAction[] {
    const passage = projectIndex.getPassageAt(uri, position);
    if (passage === undefined) {
        return [];
    }
    return generateCodeActions(uri, passage, diagnostics);
}
