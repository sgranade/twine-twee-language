import {
    CompletionList,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { all as allModifiers } from "./modifiers";

function generateModifierCompletions(
    document: TextDocument,
    modifierContentStart: number,
    offset: number
): CompletionList | null {
    const text = document.getText();
    let i = offset;

    // Make sure we don't need to move the modifier content start
    // to a semicolon
    for (; i > modifierContentStart; i--) {
        if (text[i] === ";") {
            // Move forward ahead of the semicolon
            i++;
            break;
        }
    }
    modifierContentStart = i;

    // Find the end of the modifier section: ], ;, or the end of the line

    for (i = offset; i < text.length; i++) {
        if (
            text[i] === "]" ||
            text[i] === ";" ||
            text[i] === "\r" ||
            text[i] === "\n"
        ) {
            break;
        }
    }

    const modifierCompletions: string[] = [];
    for (const modifier of allModifiers()) {
        modifierCompletions.push(...modifier.completions);
    }
    const completionList = CompletionList.create(
        modifierCompletions.map((c) => {
            return { label: c, kind: CompletionItemKind.Function };
        })
    );
    completionList.itemDefaults = {
        insertTextFormat: InsertTextFormat.Snippet,
        editRange: Range.create(
            document.positionAt(modifierContentStart),
            document.positionAt(i)
        ),
    };

    return completionList;
}

function generateInsertCompletions(
    document: TextDocument,
    modifierContentStart: number,
    offset: number,
    index: ProjectIndex
): CompletionList | null {
    return null;
}

export function generateCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): CompletionList | null {
    const offset = document.offsetAt(position);
    const text = document.getText();
    let i = offset;

    // See if we're inside a modifier or insert
    for (; i >= 0; i--) {
        // Don't go further back than the current line
        if (text[i] === "\n") break;
        // { marks a potential insert; [ at the start of a line is a modifier
        if (
            text[i] === "{" ||
            (text[i] === "[" && (i === 0 || text[i - 1] === "\n"))
        ) {
            break;
        }
    }
    if (text[i] === "[") {
        return generateModifierCompletions(document, i + 1, offset);
    } else if (text[i] === "{") {
        return generateInsertCompletions(document, i + 1, offset, index);
    }

    return null;
}
