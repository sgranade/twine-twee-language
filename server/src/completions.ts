import { v4 } from "uuid";
import {
    CompletionItem,
    CompletionItemKind,
    CompletionList,
    InsertTextFormat,
    Position,
    Range,
    TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    EmbeddedDocument,
    doComplete,
    parseJSON,
    storyDataJSONUri,
    updateEmbeddedDocument,
} from "./embedded-languages";
import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex } from "./project-index";
import { containingRange, positionInRange } from "./utilities";

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
        label: newText,
        kind: kind,
        documentation: documentation,
        insertTextFormat: InsertTextFormat.Snippet,
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

/**
 * Remove item defaults from a completion list.
 *
 * Not all clients support completion item defaults. For those, add the default
 * values to each individual completion item.
 *
 * @param completionList Completion list with item defaults.
 * @returns List with defaults added to each individual completion item.
 */
function removeCompletionListItemDefaults(
    completionList: CompletionList
): CompletionList {
    const insertTextFormat = completionList.itemDefaults?.insertTextFormat;
    const editRange = completionList.itemDefaults?.editRange;
    if (
        insertTextFormat !== undefined &&
        editRange !== undefined &&
        Range.is(editRange)
    ) {
        completionList.items = completionList.items.map((item) => {
            item.insertTextFormat = insertTextFormat;
            item.textEdit = TextEdit.replace(editRange, item.label);
            if (item.textEditText !== undefined) {
                item.label = item.textEditText;
            }
            return item;
        });
    }
    completionList.itemDefaults = undefined;
    return completionList;
}

/**
 * Generate completions for an embedded document.
 *
 * @param embeddedDocument Embedded document.
 * @param document Document to generate completions for.
 * @param position Where to generate the completions.
 * @param index Twine project index.
 * @returns Completion list, or null if no completions.
 */
async function generateEmbeddedDocumentCompletions(
    embeddedDocument: EmbeddedDocument,
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Promise<CompletionList | null> {
    const completionOffset = document.offsetAt(position);

    // Some clients (looking at you, VS Code) ask for completions before
    // the change propagates to the server, leaving the embedded document
    // out of sync with the parent, so make sure to update it if needed
    embeddedDocument = updateEmbeddedDocument(embeddedDocument, document);

    const embeddedDocOffset = document.offsetAt(embeddedDocument.range.start);
    const completions =
        (await doComplete(document, embeddedDocument, completionOffset)) ||
        CompletionList.create([], false);

    // Adjust the completion items for StoryData
    if (embeddedDocument.document.uri === storyDataJSONUri) {
        // If one of the completion items is the IFID property, generate a
        // new IFID value to go with it
        const ifidItem = completions.items.find(
            (item) => item.insertText === '"ifid": "$1"'
        );
        if (ifidItem !== undefined) {
            ifidItem.insertText = `"ifid": "${v4().toUpperCase()}"$1`;
            if (ifidItem.textEdit?.newText !== undefined) {
                ifidItem.textEdit.newText = ifidItem.insertText;
            }
        }

        completions.items.push(
            ...generateStoryDataCompletions(
                embeddedDocument,
                completionOffset - embeddedDocOffset,
                index
            )
        );
    }

    // The completions's positions are relative to the sub-document, so we need
    // to adjust those to be relative to the parent document
    if (completions !== null) {
        for (const item of completions.items) {
            if (item.textEdit !== undefined && "range" in item.textEdit) {
                item.textEdit.range = containingRange(
                    embeddedDocument.document,
                    item.textEdit.range,
                    document,
                    embeddedDocOffset
                );
            }
        }
    }

    return completions;
}

/**
 * Generate completions for a document.
 *
 * @param document Document to generate completions for.
 * @param position Where to generate the completions.
 * @param index Twine project index.
 * @param hasCompletionListItemDefaults Whether the client supports CompletionList.itemDefaults
 * @returns Completion list, or null if no completions.
 */
export async function generateCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    hasCompletionListItemDefaults: boolean
): Promise<CompletionList | null> {
    const completionOffset = document.offsetAt(position);
    let passageDocument: EmbeddedDocument | undefined;

    // Embedded documents get to create their own completions
    for (let embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        if (positionInRange(position, embeddedDocument.range)) {
            // If the document corresponds to an entire passage, wait to form completions
            // from it until after everything else has had its chance
            if (embeddedDocument.isPassage) {
                passageDocument = embeddedDocument;
            } else {
                return await generateEmbeddedDocumentCompletions(
                    embeddedDocument,
                    document,
                    position,
                    index
                );
            }
        }
    }

    // See if we're potentially inside a Twine link
    const text = document.getText();
    let i = completionOffset;
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

        // Find where the link should end: ]], <-, or the end of the line
        let linkEndOffset: number | undefined;
        let suggestAPassage = true;
        for (i = completionOffset; i < text.length; i++) {
            // Don't go further forward than the current line,
            // the pipe character, or a ->
            if (text[i] === "\r" || text[i] === "\n") break;
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

            let completionList = CompletionList.create(
                index.getPassageNames().map((p): CompletionItem => {
                    return {
                        label: p,
                        kind: CompletionItemKind.Class,
                    };
                }),
                false
            );
            completionList.itemDefaults = {
                editRange: replacementRange,
                insertTextFormat: InsertTextFormat.Snippet,
            };
            if (!hasCompletionListItemDefaults) {
                completionList =
                    removeCompletionListItemDefaults(completionList);
            }
            return completionList;
        }
    }

    // If there's a story format, let its parser provide optional completions
    const storyFormat = index.getStoryData()?.storyFormat;
    if (storyFormat !== undefined) {
        const parser = getStoryFormatParser(storyFormat);
        if (parser !== undefined) {
            let completionList = parser.generateCompletions(
                document,
                position,
                index
            );
            if (completionList !== null) {
                if (!hasCompletionListItemDefaults) {
                    completionList =
                        removeCompletionListItemDefaults(completionList);
                }
                return completionList;
            }
        }
    }

    // Finally, let any passage-wide document produce completions
    if (passageDocument !== undefined) {
        return await generateEmbeddedDocumentCompletions(
            passageDocument,
            document,
            position,
            index
        );
    }

    return null;
}
