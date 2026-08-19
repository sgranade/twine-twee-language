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

import { diagnosticCodeSet } from "./diagnostics";
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
    documentation?: string,
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
    documentation?: string,
): CompletionItem[] {
    const completions: CompletionItem[] = [];

    for (const label of labels) {
        completions.push(
            createStringCompletion(label, range, kind, documentation),
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
    index: ProjectIndex,
): CompletionItem[] {
    const completions: CompletionItem[] = [];

    const jsonDocument = parseJSON(embeddedDocument.document);
    const node = jsonDocument.getNodeFromOffset(offset);
    if (node?.parent?.type === "property") {
        const nodeRange = Range.create(
            embeddedDocument.document.positionAt(node.offset),
            embeddedDocument.document.positionAt(node.offset + node.length),
        );

        // A new IFID value
        if (node.parent.keyNode.value === "ifid") {
            completions.push(
                createStringCompletion(
                    v4().toUpperCase(),
                    nodeRange,
                    CompletionItemKind.Text,
                    "Newly-generated IFID",
                ),
            );
        }

        // Story formats
        if (node.parent.keyNode.value === "format") {
            completions.push(
                ...createStringCompletions(
                    "Chapbook|Harlowe|SugarCube".split("|"),
                    nodeRange,
                    CompletionItemKind.Text,
                ),
            );
        }

        // Start
        if (node.parent.keyNode.value === "start") {
            completions.push(
                ...createStringCompletions(
                    index.getPassageNames(),
                    nodeRange,
                    CompletionItemKind.Class,
                ),
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
                    CompletionItemKind.Color,
                ),
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
    completionList: CompletionList,
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
 * @param doCompleteFn: Embedded document doComplete function.
 * @returns Completion list, or null if no completions.
 */
async function generateEmbeddedDocumentCompletions(
    embeddedDocument: EmbeddedDocument,
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    doCompleteFn: typeof doComplete,
): Promise<CompletionList | null> {
    const completionOffset = document.offsetAt(position);

    // Some clients (looking at you, VS Code) ask for completions before
    // the change propagates to the server, leaving the embedded document
    // out of sync with the parent, so make sure to update it if needed
    embeddedDocument = updateEmbeddedDocument(embeddedDocument, document);

    const embeddedDocOffset = document.offsetAt(embeddedDocument.range.start);
    const completions =
        (await doCompleteFn(document, embeddedDocument, completionOffset)) ||
        CompletionList.create([], false);

    // Adjust the completion items for StoryData
    if (embeddedDocument.document.uri === storyDataJSONUri) {
        // If one of the completion items is the IFID property, generate a
        // new IFID value to go with it
        const ifidItem = completions.items.find(
            (item) => item.insertText === '"ifid": "$1"',
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
                index,
            ),
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
                    embeddedDocOffset,
                );
            }
        }
    }

    return completions;
}

/**
 * Generate Twine link completions if possible.
 *
 * @param document Document to generate completions for.
 * @param completionOffset Offset into the document where to generate the completions.
 * @param index Twine project index.
 * @param hasCompletionListItemDefaults Whether the client supports CompletionList.itemDefaults.
 * @returns Completion list, or null if no Twine link completions are possible.
 */
function generateTwineLinkCompletions(
    document: TextDocument,
    completionOffset: number,
    index: ProjectIndex,
    hasCompletionListItemDefaults: boolean,
): CompletionList | undefined {
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

        // If we didn't have a pipe or -> to the right, suggest passage names
        if (suggestAPassage) {
            if (linkEndOffset === undefined) {
                linkEndOffset = i;
            }
            const replacementRange = Range.create(
                document.positionAt(linkBeginOffset),
                document.positionAt(linkEndOffset),
            );

            let completionList = CompletionList.create(
                index.getPassageNames().map((p): CompletionItem => {
                    return {
                        label: p,
                        kind: CompletionItemKind.Class,
                    };
                }),
                false,
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
}

/**
 * Generate Twine passage tag completions if possible.
 *
 * @param document Document to generate completions for.
 * @param position Where to generate the completions.
 * @param index Twine project index.
 * @param hasCompletionListItemDefaults Whether the client supports CompletionList.itemDefaults.
 * @returns Completion list, or null if no tag completions are possible.
 */
function generatePassageTagCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    hasCompletionListItemDefaults: boolean,
): CompletionList | undefined {
    // We will only have tag completions if the position is on the same line
    // as the passage's name and also after its name
    const passage = index.getPassageAt(document.uri, position);
    if (
        passage === undefined ||
        passage.name.location.range.start.line !== position.line ||
        passage.name.location.range.end.character >= position.character
    )
        return;

    const completionOffset = document.offsetAt(position);
    const text = document.getText();
    let tagBeginOffset: number | undefined;
    let bracketOffset: number | undefined;
    let spaceOffset: number | undefined;
    let commaOffset: number | undefined;
    // Find where the tags begin and note if there's a space before us
    for (let i = completionOffset; i >= 0; i--) {
        // Don't go further back than the current line
        if (text[i] === "\n") break;

        // Go until we find a leading [, but note if we find a space or a comma (prior to a space)
        if (text[i] === "[") {
            bracketOffset = i;
            tagBeginOffset = i + 1;
            break;
        } else if (
            text[i] === "," &&
            spaceOffset === undefined &&
            commaOffset === undefined
        ) {
            commaOffset = i;
        } else if (text[i] === " " && spaceOffset === undefined) {
            spaceOffset = i;
        }
    }
    if (tagBeginOffset === undefined) return;

    // If we found a space, that's where the tag should begin
    if (spaceOffset !== undefined) {
        tagBeginOffset = spaceOffset + 1;
    }

    // Find where the tag should end: ], { (for metadata), a space, or EOL
    let tagEndOffset: number | undefined;
    for (
        tagEndOffset = completionOffset;
        tagBeginOffset < text.length;
        tagEndOffset++
    ) {
        // Don't go further than the current line, ], {, or a space
        if (
            text[tagEndOffset] === "]" ||
            text[tagEndOffset] === "{" ||
            text[tagEndOffset] === " " ||
            text[tagEndOffset] === "\r" ||
            text[tagEndOffset] === "\n"
        ) {
            break;
        }
    }
    tagEndOffset--;
    // Handle the case where the tag is empty []
    if (tagEndOffset < tagBeginOffset) tagEndOffset = tagBeginOffset;

    let tags: Set<string>;
    // If the tag `tt3-disable` is before the current one, we need to suggest diagnostics
    if (/tt3-disable\s+$/.test(text.slice(bracketOffset, tagBeginOffset))) {
        tags = new Set<string>(diagnosticCodeSet);
        if (commaOffset !== undefined) {
            for (const code of text
                .slice(tagBeginOffset, tagEndOffset)
                .split(",")) {
                tags.delete(code);
            }
            tagBeginOffset = commaOffset + 1;
            if (tagEndOffset < tagBeginOffset) {
                tagEndOffset = tagBeginOffset;
            }
        }
    } else {
        tags = new Set<string>(index.getAllPassageTags());
        // Remove any current passage tags from the list
        if (passage.tags) {
            for (const t of passage.tags) {
                tags.delete(t.contents);
            }
        }
    }
    let completionList = CompletionList.create(
        [...tags].map((t): CompletionItem => {
            return { label: t, kind: CompletionItemKind.Text };
        }),
        false,
    );
    completionList.itemDefaults = {
        editRange: Range.create(
            document.positionAt(tagBeginOffset),
            document.positionAt(tagEndOffset),
        ),
        insertTextFormat: InsertTextFormat.Snippet,
    };
    if (!hasCompletionListItemDefaults) {
        completionList = removeCompletionListItemDefaults(completionList);
    }
    return completionList;
}

/**
 * Interface for external functions used by generateCompletions()
 */
export interface CompletionGenerationAPI {
    embeddedDocumentDoComplete: typeof doComplete;
    getStoryFormatParser: typeof getStoryFormatParser;
}

const defaultCompletionGenerationAPI: CompletionGenerationAPI = {
    embeddedDocumentDoComplete: doComplete,
    getStoryFormatParser: getStoryFormatParser,
};

/**
 * Generate completions for a document.
 *
 * @param document Document to generate completions for.
 * @param position Where to generate the completions.
 * @param index Twine project index.
 * @param hasCompletionListItemDefaults Whether the client supports CompletionList.itemDefaults.
 * @param api API for completion generation.
 * @returns Completion list, or null if no completions.
 */
export async function generateCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex,
    hasCompletionListItemDefaults: boolean,
    api: CompletionGenerationAPI = defaultCompletionGenerationAPI,
): Promise<CompletionList | null> {
    const completionOffset = document.offsetAt(position);
    let passageDocument: EmbeddedDocument | undefined;
    const deferredEmbeddedDocuments: EmbeddedDocument[] = [];

    // Embedded documents get to create their own completions
    for (const embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        if (positionInRange(position, embeddedDocument.range)) {
            // If the document corresponds to an entire passage, wait to form completions
            // from it until after everything else has had its chance. If it's deferred to
            // story formats to handle, add it to the list of deferred embedded documents.
            if (embeddedDocument.isPassage) {
                passageDocument = embeddedDocument;
            } else if (embeddedDocument.deferToStoryFormat) {
                deferredEmbeddedDocuments.push(embeddedDocument);
            } else {
                return await generateEmbeddedDocumentCompletions(
                    embeddedDocument,
                    document,
                    position,
                    index,
                    api.embeddedDocumentDoComplete,
                );
            }
        }
    }

    // See if we're potentially inside a Twine link
    const linkCompletions = generateTwineLinkCompletions(
        document,
        completionOffset,
        index,
        hasCompletionListItemDefaults,
    );
    if (linkCompletions) return linkCompletions;

    // See if we're potentially creating tags
    const tagCompletions = generatePassageTagCompletions(
        document,
        position,
        index,
        hasCompletionListItemDefaults,
    );
    if (tagCompletions) return tagCompletions;

    // If there's a story format, let its parser provide optional completions
    const storyFormat = index.getStoryData()?.storyFormat;
    if (storyFormat !== undefined) {
        const parser = api.getStoryFormatParser(storyFormat);
        if (parser !== undefined) {
            let completionList = parser.generateCompletions(
                document,
                position,
                deferredEmbeddedDocuments,
                index,
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
            index,
            api.embeddedDocumentDoComplete,
        );
    }

    return null;
}
