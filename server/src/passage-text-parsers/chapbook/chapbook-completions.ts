import {
    CompletionList,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    Range,
    CompletionItem,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import {
    ArgumentRequirement,
    InsertProperty,
    ValueType,
    all as allInserts,
} from "./inserts";
import { all as allModifiers } from "./modifiers";
import { removeAndCountPadding } from "../../utilities";

/**
 * The character that marks the end of a modifier.
 */
const modifierStopChar = /[\];\r\n]/g;

/**
 * Generate completions for a Chapbook [modifier].
 *
 * @param document Document in which to generate the completions.
 * @param modifierContentStart Offset where the modifier starts (just past the [).
 * @param offset Offset where the completion is to be generated.
 * @returns Completions list.
 */
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
    modifierStopChar.lastIndex = offset;
    let modifierContentEnd = modifierStopChar.test(text)
        ? modifierStopChar.lastIndex - 1
        : text.length;

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
            document.positionAt(modifierContentEnd)
        ),
    };

    return completionList;
}

/**
 * Add a snippet tab stop to a placeholder.
 *
 * If the placeholder is a 'quoted string', the tab stop will
 * be inside the string.
 *
 * @param placeholder Placeholder to tab-stoppify.
 * @param tabStop Tab stop number.
 * @returns Placeholder with tab stop number.
 */
function placeholderWithTabStop(placeholder: string, tabStop?: number): string {
    if (tabStop !== undefined) {
        // If we are going to put in a tab stop and the completion is a quoted string,
        // put the tab stop inside the quote marks
        if (placeholder.startsWith('"') || placeholder.startsWith("'")) {
            placeholder = `${placeholder[0]}\${${tabStop}:${placeholder.slice(1, -1)}}${placeholder[0]}`;
        } else {
            placeholder = `\${${tabStop}:${placeholder}}`;
        }
    }

    return placeholder;
}

/**
 * Turn information about a property into a placeholder.
 *
 * @param info Information about the property: either a completion string, InsertProperty, or null.
 * @param tabStop Tab stop number (if any) to put inside the completion string
 * @returns The placeholder string.
 */
function propertyPlaceholder(
    info: string | InsertProperty | null,
    tabStop?: number
): string {
    let placeholder = "'arg'";
    if (InsertProperty.is(info)) {
        placeholder = info.placeholder;
    } else if (typeof info === "string") {
        placeholder = info;
    }
    return placeholderWithTabStop(placeholder, tabStop);
}

/**
 * Convert insert properties to completion items.
 *
 * @param props Properties to convert.
 * @returns Completion items corresponding to the properties.
 */
function propertiesToCompletionItems(
    props: Record<string, string | InsertProperty | null>
): CompletionItem[] {
    return (
        Object.entries(props) as [string, string | InsertProperty | null][]
    ).map(([name, info]) => {
        return {
            label: name,
            kind: CompletionItemKind.Property,
            textEditText: ` ${name}: ${propertyPlaceholder(info, 1)}`,
        };
    });
}

/**
 *
 * @param document Document in which to generate the completions.
 * @param section Text of the insert section where completions will go.
 * @param start Offset where the insert section begins in the document.
 * @param end Offset where the insert section ends.
 * @param index Project index.
 * @returns Completions list.
 */
function generatePassageCompletions(
    document: TextDocument,
    section: string,
    start: number,
    end: number,
    index: ProjectIndex
): CompletionList {
    // If there's existing text surrounded by quotes, we need to
    // leave those in place so editors that reduce completion options
    // based on that existing text don't fail because none of the
    // passage names start with quote marks
    let prefix = "'";
    let suffix = "'";
    const [sec, padLeft, padRight] = removeAndCountPadding(section);
    start += padLeft;
    end -= padRight;
    if (sec.startsWith("'") || sec.startsWith('"')) {
        prefix = "";
        suffix = sec[0];
        start++;
    }
    if (sec.endsWith("'") || sec.endsWith('"')) {
        suffix = "";
        if (prefix !== "") prefix = sec.slice(-1);
        end--;
    }

    const completionList = CompletionList.create(
        index.getPassageNames().map((p) => {
            return {
                label: p,
                kind: CompletionItemKind.Class,
                textEditText: `${prefix}${p}${suffix}`,
            };
        })
    );
    completionList.itemDefaults = {
        insertTextFormat: InsertTextFormat.Snippet,
        editRange: Range.create(
            document.positionAt(start),
            document.positionAt(end)
        ),
    };

    return completionList;
}

/**
 * The character that marks the end of an insert's section.
 */
const insertStopChar = /[,:}\r\n]/g;

/**
 * Generate completions for a Chapbook {insert}.
 *
 * @param document Document in which to generate the completions.
 * @param insertContentStart Offset where the insert starts (just past the {).
 * @param offset Offset where the completion is to be generated.
 * @returns Completions list.
 */
function generateInsertCompletions(
    document: TextDocument,
    insertContentStart: number,
    offset: number,
    index: ProjectIndex
): CompletionList | null {
    let i: number;
    const text = document.getText();
    const inserts = allInserts();

    insertStopChar.lastIndex = insertContentStart;
    let insertNameEnd = insertStopChar.test(text)
        ? insertStopChar.lastIndex - 1
        : text.length;

    if (offset <= insertNameEnd) {
        // Insert's name

        // If we're at the end of the document, treat only the word up to the cursor position
        // as the end of the insert's name
        if (insertNameEnd === text.length) {
            for (i = offset; i < text.length; ++i) {
                if (text[i] === " ") {
                    insertNameEnd = i;
                    break;
                }
            }
        }

        const colonMissing = text[insertNameEnd] !== ":";
        const commaMissing = text[insertNameEnd] !== ",";
        let placeholderCount = 1;
        const insertCompletions: CompletionItem[] = [];
        for (const insert of inserts) {
            for (const label of insert.completions) {
                let textEditText = label;
                if (
                    colonMissing &&
                    insert.arguments.firstArgument.required ===
                        ArgumentRequirement.required
                ) {
                    const placeholder =
                        insert.arguments.firstArgument.placeholder !== undefined
                            ? insert.arguments.firstArgument.placeholder
                            : "'arg'";
                    textEditText += `: ${placeholderWithTabStop(placeholder, placeholderCount++)}`;
                }
                // If there's no comma, put in placeholders for any required properties
                if (commaMissing) {
                    for (const [name, info] of Object.entries(
                        insert.arguments.requiredProps
                    )) {
                        textEditText += `, ${name}: ${propertyPlaceholder(info, placeholderCount++)}`;
                    }
                }
                insertCompletions.push({
                    label: label,
                    kind: CompletionItemKind.Function,
                    textEditText: textEditText,
                });
            }
        }
        const completionList = CompletionList.create(insertCompletions);
        completionList.itemDefaults = {
            insertTextFormat: InsertTextFormat.Snippet,
            editRange: Range.create(
                document.positionAt(insertContentStart),
                document.positionAt(insertNameEnd)
            ),
        };

        return completionList;
    }

    const insertName = text.slice(insertContentStart, insertNameEnd);
    const insert = inserts.find((insert) => insert.match.test(insertName));
    if (insert === undefined) return null; // No insert? No completions.

    // Find where this section of the insert ends
    insertStopChar.lastIndex = offset;
    let insertSectionEnd = insertStopChar.test(text)
        ? insertStopChar.lastIndex - 1
        : offset;

    // Now find where this section begins
    for (
        i = offset;
        i > insertContentStart && text[i] !== ":" && text[i] !== ",";
        --i
    );

    if (text[i] === ",") {
        // Property name

        const insertSectionStart = i + 1; // To leave the comma alone

        // If there's a colon already in the text, swallow it
        if (text[insertSectionEnd] === ":") insertSectionEnd++;

        const propCompletions = propertiesToCompletionItems(
            insert.arguments.requiredProps
        );
        propCompletions.push(
            ...propertiesToCompletionItems(insert.arguments.optionalProps)
        );
        const completionList = CompletionList.create(propCompletions);
        completionList.itemDefaults = {
            insertTextFormat: InsertTextFormat.Snippet,
            editRange: Range.create(
                document.positionAt(insertSectionStart),
                document.positionAt(insertSectionEnd)
            ),
        };

        return completionList;
    }

    // We should be either at the insert's first argument or a property value,
    // indicated by having stopped the backwards search at a :. If that's not
    // the case, then we won't have any completions.
    if (text[i] !== ":") return null;

    const insertSectionStart = i + 1; // To leave the colon alone

    // If insertNameEnd abuts this section, we're at the insert's first argument
    if (i === insertNameEnd) {
        // First argument

        // Create completions if the first argument's type supports it
        if (insert.arguments.firstArgument.type === ValueType.passage) {
            return generatePassageCompletions(
                document,
                text.slice(insertSectionStart, insertSectionEnd),
                insertSectionStart,
                insertSectionEnd,
                index
            );
        }
    } else {
        // Property value

        // Find the property's name by scanning further back
        for (
            i = i - 1; // Skip before the property's colon
            i > insertNameEnd && text[i] !== ",";
            --i
        );
        if (text[i] === ",") {
            const propertyNameStart = i + 1;
            const propertyNameEnd = insertSectionStart - 1; // End at the :
            const propName = text
                .slice(propertyNameStart, propertyNameEnd)
                .trim();
            const propInfo =
                insert.arguments.requiredProps[propName] ||
                insert.arguments.optionalProps[propName];

            // Create completions if the property's value type supports it
            if (
                InsertProperty.is(propInfo) &&
                propInfo.type === ValueType.passage
            ) {
                return generatePassageCompletions(
                    document,
                    text.slice(insertSectionStart, insertSectionEnd),
                    insertSectionStart,
                    insertSectionEnd,
                    index
                );
            }
        }
    }

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
