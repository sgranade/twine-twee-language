import { v4 } from "uuid";
import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    InsertTextFormat,
    Position,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    EmbeddedDocument,
    doComplete,
    parseJSON,
    storyDataJSONUri,
} from "./embedded-languages";
import { ProjectIndex } from "./project-index";
import { containingRange } from "./utilities";

/**
 * Create a string completion.
 *
 * A string completion is a label that will replace the entire string in the
 * document, including quote marks.
 *
 * @param label Completion label.
 * @param range Range to be replaced in the document.
 * @param kind Completion item's kind.
 * @param documentation Documentation about the completion item.
 * @returns Completion item.
 */
function createStringCompletion(
    label: string,
    range: Range,
    kind?: CompletionItemKind,
    documentation?: string
): CompletionItem {
    const newText = `"${label}"`;
    const item = {
        label: label,
        kind: kind,
        documentation: documentation,
        insertText: newText,
        insertTextFormat: InsertTextFormat.Snippet,
        filterText: newText,
        textEdit: {
            range: range,
            newText: newText,
        },
    };
    return item;
}

/**
 * Create an array of string completion items from labels.
 *
 * @param labels Labels for the completion items.
 * @param range Range to be replaced in the document.
 * @param kind Completion items' kind.
 * @param documentation Documentation about the completion item.
 * @returns Completion items.
 */
function createStringCompletions(
    labels: readonly string[],
    range: Range,
    kind?: CompletionItemKind,
    documentation?: string
): CompletionItem[] {
    const completions: CompletionItem[] = [];

    for (const label of labels) {
        completions.push(
            createStringCompletion(label, range, kind, documentation)
        );
    }

    return completions;
}

/**
 * Find completion items inside a Story Data passage.
 *
 * @param embeddedDocument Embedded document.
 * @param jsonDocument Embedded document as a parsed JSON document.
 * @param offset Cursor offset into the embedded document.
 * @param index Project index.
 * @returns Completion items.
 */
function generateStoryDataCompletions(
    embeddedDocument: EmbeddedDocument,
    offset: number,
    index: ProjectIndex
): CompletionItem[] {
    const completions: CompletionItem[] = [];

    const jsonDocument = parseJSON(embeddedDocument.document);
    const node = jsonDocument.getNodeFromOffset(offset);
    if (node?.parent?.type === "property") {
        const nodeRange = Range.create(
            embeddedDocument.document.positionAt(node.offset),
            embeddedDocument.document.positionAt(node.offset + node.length)
        );

        // A new IFID value
        if (node.parent.keyNode.value === "ifid") {
            completions.push(
                createStringCompletion(
                    v4().toUpperCase(),
                    nodeRange,
                    CompletionItemKind.Text,
                    "Newly-generated IFID"
                )
            );
        }

        // Story formats
        if (node.parent.keyNode.value === "format") {
            completions.push(
                ...createStringCompletions(
                    "Chapbook|Harlowe|SugarCube".split("|"),
                    nodeRange,
                    CompletionItemKind.Text
                )
            );
        }

        // Start
        if (node.parent.keyNode.value === "start") {
            const uniquePassageNames = new Set<string>(index.getPassageNames());
            completions.push(
                ...createStringCompletions(
                    [...uniquePassageNames],
                    nodeRange,
                    CompletionItemKind.Class
                )
            );
        }

        // A color value in the tag-colors property
        if (
            node.parent.parent?.parent?.type === "property" &&
            node.parent.parent.parent.keyNode.value === "tag-colors"
        ) {
            completions.push(
                ...createStringCompletions(
                    "gray|red|orange|yellow|green|blue|purple".split("|"),
                    nodeRange,
                    CompletionItemKind.Color
                )
            );
        }
    }

    return completions;
}

export async function generateCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Promise<CompletionList | null> {
    const offset = document.offsetAt(position);
    let completions: CompletionList | null = null;

    // Embedded documents get to create their own completions
    for (const embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        if (
            offset >= embeddedDocument.offset &&
            offset <
                embeddedDocument.offset +
                    embeddedDocument.document.getText().length
        ) {
            completions =
                (await doComplete(embeddedDocument, offset)) ||
                CompletionList.create([], false);

            // Add custom completions for specific items
            if (embeddedDocument.document.uri === storyDataJSONUri) {
                completions.items.push(
                    ...generateStoryDataCompletions(
                        embeddedDocument,
                        offset - embeddedDocument.offset,
                        index
                    )
                );
            }

            // The completions's positions are relative to the sub-document, so we need
            // to adjust those to be relative to the parent document
            if (completions !== null) {
                for (const item of completions.items) {
                    if (
                        item.textEdit !== undefined &&
                        "range" in item.textEdit
                    ) {
                        item.textEdit.range = containingRange(
                            embeddedDocument.document,
                            item.textEdit.range,
                            document,
                            embeddedDocument.offset
                        );
                    }
                }
            }

            // Embedded documents aren't nested, so we can quit looking
            return completions;
        }
    }

    // See if we're potentially inside a Twine link
    const text = document.getText();
    let i = offset;
    let linkBeginOffset: number | undefined;
    let arrowOrPipeOffset: number | undefined;
    // Find where the link should begin: [[, -> or |
    for (; i >= 1; i--) {
        // Don't go further back than the current line
        if (text[i] === "\n") break;

        // Go until we find a leading [[, but note if we see a -> or | along the way
        if (text[i - 1] === "[" && text[i] === "[") {
            linkBeginOffset = i + 1;
            break;
        } else if (
            text[i] === "|" ||
            (text[i - 1] === "-" && text[i] === ">")
        ) {
            arrowOrPipeOffset = i + 1;
        }
    }
    if (linkBeginOffset !== undefined) {
        // If we found an arrow or pipe, that's where the link should begin
        if (arrowOrPipeOffset !== undefined) {
            linkBeginOffset = arrowOrPipeOffset;
        }

        // Find where the link should end: either ]], <-, or (if none of those), at the end of the current word
        let linkEndOffset: number | undefined;
        let suggestAPassage = true;
        for (i = offset; i < text.length; i++) {
            // Don't go further forward than the current line,
            // the pipe character, or a ->
            if (text[i] === "\n") break;
            if (text[i] === "|" || (text[i] === "-" && text[i + 1] === ">")) {
                suggestAPassage = false;
                break;
            }

            if (
                (text[i] === "]" && text[i + 1] === "]") ||
                (text[i] === "<" && text[i + 1] === "-") ||
                text[i] === "|"
            ) {
                linkEndOffset = i;
                break;
            }
        }

        // If we didn't a pipe or -> to the right, suggest passage names
        if (suggestAPassage) {
            if (linkEndOffset === undefined) {
                linkEndOffset = i;
            }
            const replacementRange = Range.create(
                document.positionAt(linkBeginOffset),
                document.positionAt(linkEndOffset)
            );

            completions = CompletionList.create(
                index.getPassageNames().map((p): CompletionItem => {
                    return {
                        label: p,
                        kind: CompletionItemKind.Class,
                        insertText: p,
                        insertTextFormat: InsertTextFormat.Snippet,
                        filterText: p,
                        textEdit: {
                            range: replacementRange,
                            newText: p,
                        },
                    };
                }),
                false
            );

            return completions;
        }
    }

    return completions;
}
