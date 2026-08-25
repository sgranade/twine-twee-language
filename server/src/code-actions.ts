import {
    CodeAction,
    CodeActionKind,
    Diagnostic,
    Position,
    TextEdit,
} from "vscode-languageserver";

import { DisableDiagnosticTag, isDiagnosticCode } from "@tt3/shared";
import { Label, Passage } from "./project-index";
import { TwineDiagnostic } from "./diagnostics";

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
 * Generate code actions for the extension.
 * @param uri Document URI.
 * @param passage Passage that contains the diagnostics.
 * @param diagnostics Diagnostics from that passage.
 * @returns
 */
export function generateCodeActions(
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

    for (const d of diagnostics.filter(
        (d) =>
            d.source === "Twine" &&
            typeof d.code === "string" &&
            isDiagnosticCode(d.code),
    ) as TwineDiagnostic[]) {
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
        actions.push(
            CodeAction.create(
                `Disable ${d.code} for this passage`,
                {
                    changes: { [uri]: [TextEdit.insert(insertPos, editText)] },
                },
                CodeActionKind.QuickFix,
            ),
        );
    }

    return actions;
}
