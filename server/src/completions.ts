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
import { JSONDocument } from "vscode-json-languageservice";

import { ProjectIndex } from "./index";
import { jsonLanguageService, storyDataJSONUri } from "./parser";
import { containingRange, normalizeUri } from "./utilities";

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
    embeddedDocument: TextDocument,
    jsonDocument: JSONDocument,
    offset: number,
    index: ProjectIndex
): CompletionItem[] {
    const completions: CompletionItem[] = [];

    const node = jsonDocument.getNodeFromOffset(offset);
    if (node?.parent?.type === "property") {
        // A new IFID value
        if (node.parent.keyNode.value === "ifid") {
            completions.push(
                createStringCompletion(
                    v4().toUpperCase(),
                    Range.create(
                        embeddedDocument.positionAt(node.offset),
                        embeddedDocument.positionAt(node.offset + node.length)
                    ),
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
                    Range.create(
                        embeddedDocument.positionAt(node.offset),
                        embeddedDocument.positionAt(node.offset + node.length)
                    ),
                    CompletionItemKind.Text
                )
            );
        }

        // Start
        if (node.parent.keyNode.value === "start") {
            completions.push(
                ...createStringCompletions(
                    index.getPassageNames(),
                    Range.create(
                        embeddedDocument.positionAt(node.offset),
                        embeddedDocument.positionAt(node.offset + node.length)
                    ),
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
                    Range.create(
                        embeddedDocument.positionAt(node.offset),
                        embeddedDocument.positionAt(node.offset + node.length)
                    ),
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
    const documentUri = normalizeUri(document.uri);
    const offset = document.offsetAt(position);
    let completions: CompletionList | null = null;

    // Embedded documents get to create their own completions
    for (const {
        document: embeddedDocument,
        jsonDocument,
        position: embeddedPosition,
    } of index.getEmbeddedJSONDocuments(documentUri) || []) {
        const embeddedDocumentOffset = document.offsetAt(embeddedPosition);

        if (
            offset >= embeddedDocumentOffset &&
            offset < embeddedDocumentOffset + embeddedDocument.getText().length
        ) {
            completions =
                (await jsonLanguageService.doComplete(
                    embeddedDocument,
                    embeddedDocument.positionAt(
                        offset - embeddedDocumentOffset
                    ),
                    jsonDocument
                )) || CompletionList.create([], false);

            // Add custom completions for specific items
            if (embeddedDocument.uri === storyDataJSONUri) {
                completions.items.push(
                    ...generateStoryDataCompletions(
                        embeddedDocument,
                        jsonDocument,
                        offset - embeddedDocumentOffset,
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
                            embeddedDocument,
                            item.textEdit.range,
                            document,
                            embeddedDocumentOffset
                        );
                    }
                }
            }

            // Embedded documents aren't nested, so we can quit looking
            break;
        }
    }

    return completions;
}
