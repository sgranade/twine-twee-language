import {
    CompletionList,
    CompletionItemKind,
    InsertTextFormat,
    Position,
    Range,
    CompletionItem,
    TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../../embedded-languages";
import { ProjectIndex } from "../../project-index";
import { removeAndCountPadding } from "../../utilities";
import {
    divideChapbookPassage,
    findStartOfModifierOrInsert,
    getChapbookDefinitions,
} from "./chapbook-parser";
import {
    ChapbookFunctionInfo,
    ChapbookSymbol,
    OChapbookSymbolKind,
} from "./types";
import { all as allInserts } from "./inserts";
import { all as allModifiers } from "./modifiers";
import { ArgumentRequirement, InsertProperty, ValueType } from "./types";

/**
 * Generate completions for variables and properties.
 * @param document Document in which to generate the completions.
 * @param text Text from the start of the context to the point where completions are to be generated.
 * @param offset Offset for the text in the document.
 * @param index Project index.
 * @returns Completions list.
 */
function generateVariableAndPropertyCompletions(
    document: TextDocument,
    text: string,
    offset: number,
    index: ProjectIndex
): CompletionList | null {
    const completions: string[] = [];

    // If there's a period and then variable characters at the end of the string, assume we're being
    // asked to generate properties. Only get ones that match the full context (like var1.prop)
    const m = /(\w+\.(\w+\.)*)(\w*)$/.exec(text);
    const context = m === null ? undefined : m[1];
    const range =
        m === null
            ? undefined
            : Range.create(
                  document.positionAt(offset + text.length - m[3].length),
                  document.positionAt(offset + text.length)
              );
    for (const uri of index.getIndexedUris()) {
        if (context !== undefined) {
            // Get all set properties whose contents match the full context
            const allPropRefs = [
                ...(index.getReferences(uri, OChapbookSymbolKind.PropertySet) ??
                    []),
            ];
            completions.push(
                ...(allPropRefs
                    .filter((ref) => ref.contents.startsWith(context))
                    .map(
                        (ref) => ref.contents.split(".").pop() ?? ref.contents
                    ) ?? [])
            );
        } else {
            // Get all set variables
            const allVarRefs = [
                ...(index.getReferences(uri, OChapbookSymbolKind.VariableSet) ??
                    []),
            ];
            completions.push(...allVarRefs.map((ref) => ref.contents));
        }
    }
    if (range !== undefined) {
        return CompletionList.create(
            Array.from(new Set<string>(completions)).map((c) => {
                return {
                    label: c,
                    kind: CompletionItemKind.Property,
                    textEdit: TextEdit.replace(range, c),
                };
            })
        );
    } else {
        return CompletionList.create(
            Array.from(new Set<string>(completions)).map((c) => {
                return {
                    label: c,
                    kind: CompletionItemKind.Variable,
                    textEditText: c,
                };
            })
        );
    }
}

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
 * @param index Project index.
 * @returns Completions list.
 */
function generateModifierCompletions(
    document: TextDocument,
    modifierContentStart: number,
    offset: number,
    index: ProjectIndex
): CompletionList | null {
    const text = document.getText();
    let i = offset;
    // Merge built-in and custom modifiers into one list, since they share
    // the ChapbookFunctionInfo interface
    const modifiers: ChapbookFunctionInfo[] = [
        ...allModifiers(),
        ...getChapbookDefinitions(OChapbookSymbolKind.CustomModifier, index),
    ];

    // Make sure we don't need to move the modifier content start
    // to a semicolon
    let atSemicolon = false;
    for (; i > modifierContentStart; i--) {
        if (text[i] === ";") {
            atSemicolon = true;
            // Move forward ahead of the semicolon
            i++;
            break;
        }
    }
    modifierContentStart = i;

    // Find the end of the modifier section: ], ;, or the end of the line
    modifierStopChar.lastIndex = offset;
    const modifierContentEnd = modifierStopChar.test(text)
        ? modifierStopChar.lastIndex - 1
        : text.length;

    let modifierText = text.slice(modifierContentStart, modifierContentEnd);
    // Skip only the spaces on the left
    let hasLeadingSpace = false;
    for (
        i = 0;
        i < modifierText.length && modifierText[i] === " ";
        ++i, hasLeadingSpace = true
    );
    if (i < modifierText.length) {
        modifierText = modifierText.substring(i);
        modifierContentStart += i;
    }

    const modifier = modifiers.find((modifier) =>
        modifier.match.test(modifierText)
    );
    const modifierMatch = modifier?.match.exec(modifierText) ?? undefined;

    if (modifier !== undefined && modifierMatch !== undefined) {
        // If we found a modifier, then the first text matches and we should create
        // argument completions, if any
        if (
            modifier.firstArgument?.type === ValueType.passage ||
            modifier.firstArgument?.type === ValueType.urlOrPassage
        ) {
            return generatePassageCompletions(
                document,
                text.slice(
                    modifierContentStart + modifierMatch[0].length,
                    modifierContentEnd
                ),
                modifierContentStart + modifierMatch[0].length,
                modifierContentEnd,
                index
            );
        } else if (modifier.firstArgument?.type === ValueType.expression) {
            return generateVariableAndPropertyCompletions(
                document,
                text.slice(modifierContentStart, offset),
                modifierContentStart,
                index
            );
        } else if (
            modifier.firstArgument?.required === ArgumentRequirement.required
        ) {
            const label = modifier.name ?? modifier.match.source;
            const textEditText = `${label} ${placeholderWithTabStop(modifier.firstArgument.placeholder ?? "arg", 1)}`;
            const completionList = CompletionList.create([
                {
                    label: label,
                    kind: CompletionItemKind.Function,
                    textEditText: textEditText,
                },
            ]);
            completionList.itemDefaults = {
                insertTextFormat: InsertTextFormat.Snippet,
                editRange: Range.create(
                    document.positionAt(modifierContentStart),
                    document.positionAt(modifierContentEnd)
                ),
            };
            return completionList;
        } else {
            return null;
        }
    }

    const modifierCompletions: string[] = [];
    for (const modifier of modifiers) {
        if (modifier.completions !== undefined)
            modifierCompletions.push(...modifier.completions);
        else if (modifier.name !== undefined)
            modifierCompletions.push(modifier.name);
    }
    // If we're at a semicolon and there's no leading space, put a space before each modifier's name
    const leadingSpace = atSemicolon && !hasLeadingSpace ? " " : "";
    const completionList = CompletionList.create(
        modifierCompletions.map((c) => {
            return {
                label: c,
                kind: CompletionItemKind.Function,
                textEditText: leadingSpace + c,
            };
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
 * Turn information about an insert's property into a placeholder.
 *
 * @param info Information about the property: either a completion string, InsertProperty, or null.
 * @param tabStop Tab stop number (if any) to put inside the completion string
 * @returns The placeholder string.
 */
function insertPropertyPlaceholder(
    info: string | InsertProperty | null,
    tabStop?: number
): string {
    let placeholder = "'arg'";
    if (InsertProperty.is(info) && info.placeholder !== undefined) {
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
function insertPropertiesToCompletionItems(
    props: Record<string, string | InsertProperty | null>
): CompletionItem[] {
    return (
        Object.entries(props) as [string, string | InsertProperty | null][]
    ).map(([name, info]) => {
        return {
            label: name,
            kind: CompletionItemKind.Property,
            textEditText: ` ${name}: ${insertPropertyPlaceholder(info, 1)}`,
        };
    });
}

/**
 * Generate completions for passage names.
 *
 * @param document Document in which to generate the completions.
 * @param section Text of the section where completions will go.
 * @param start Offset where the section begins in the document.
 * @param end Offset where the section ends.
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
    // Merge built-in inserts and custom inserts into one list, since they share
    // the ChapbookFunctionInfo interface
    const inserts: ChapbookFunctionInfo[] = [
        ...allInserts(),
        ...getChapbookDefinitions(OChapbookSymbolKind.CustomInsert, index),
    ];

    insertStopChar.lastIndex = insertContentStart;
    let insertNameEnd = insertStopChar.test(text)
        ? insertStopChar.lastIndex - 1
        : text.length;

    if (offset <= insertNameEnd) {
        // Insert (or variable)'s name

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
            // Completions can be explicitly defined, but if not,
            // use the insert's name or (if a custom insert) contents
            const completions = insert.completions
                ? insert.completions
                : ChapbookSymbol.is(insert) && insert.contents
                  ? [insert.contents]
                  : insert.name
                    ? [insert.name]
                    : [];
            for (const label of completions) {
                let textEditText = label;
                if (
                    colonMissing &&
                    insert.firstArgument?.required ===
                        ArgumentRequirement.required
                ) {
                    const placeholder =
                        insert.firstArgument?.placeholder !== undefined
                            ? insert.firstArgument.placeholder
                            : "'arg'";
                    textEditText += `: ${placeholderWithTabStop(placeholder, placeholderCount++)}`;
                }
                // If there's no comma, put in placeholders for any required properties
                if (commaMissing) {
                    for (const [name, info] of Object.entries(
                        insert.requiredProps ?? {}
                    )) {
                        textEditText += `, ${name}: ${insertPropertyPlaceholder(info, placeholderCount++)}`;
                    }
                }
                insertCompletions.push({
                    label: label,
                    kind: CompletionItemKind.Function,
                    textEditText: textEditText,
                });
            }
        }

        // If we have a one-word insert (so far), it could also be a variable (or property), so add those completions in
        if (
            text[insertNameEnd] === "}" ||
            text[insertNameEnd] === "\r" ||
            text[insertNameEnd] === "\n" ||
            text[insertNameEnd] === undefined
        ) {
            insertCompletions.push(
                ...(generateVariableAndPropertyCompletions(
                    document,
                    text.slice(insertContentStart, offset),
                    insertContentStart,
                    index
                )?.items ?? [])
            );
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

        const propCompletions = insertPropertiesToCompletionItems(
            insert.requiredProps ?? {}
        );
        propCompletions.push(
            ...insertPropertiesToCompletionItems(insert.optionalProps ?? {})
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
        if (
            insert.firstArgument?.type === ValueType.passage ||
            insert.firstArgument?.type === ValueType.urlOrPassage
        ) {
            return generatePassageCompletions(
                document,
                text.slice(insertSectionStart, insertSectionEnd),
                insertSectionStart,
                insertSectionEnd,
                index
            );
        } else if (insert.firstArgument?.type === ValueType.expression) {
            return generateVariableAndPropertyCompletions(
                document,
                text.slice(insertSectionStart, offset),
                insertSectionStart,
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
                insert.requiredProps?.[propName] ||
                insert.optionalProps?.[propName];

            // Create completions if the property's value type supports it
            if (InsertProperty.is(propInfo)) {
                if (
                    propInfo.type === ValueType.passage ||
                    propInfo.type === ValueType.urlOrPassage
                ) {
                    return generatePassageCompletions(
                        document,
                        text.slice(insertSectionStart, insertSectionEnd),
                        insertSectionStart,
                        insertSectionEnd,
                        index
                    );
                } else if (propInfo.type === ValueType.expression) {
                    return generateVariableAndPropertyCompletions(
                        document,
                        text.slice(insertSectionStart, offset),
                        insertSectionStart,
                        index
                    );
                }
            }
        }
    }

    return null;
}

export function generateCompletions(
    document: TextDocument,
    position: Position,
    deferredEmbeddedDocuments: EmbeddedDocument[],
    index: ProjectIndex
): CompletionList | null {
    const offset = document.offsetAt(position);
    const passage = index.getPassageAt(document.uri, position);
    if (passage === undefined) return null;

    // Passage scopes start at the ":: Passage" line, so its contents start
    // on the line after the scope's start
    const passageTextScope = Range.create(
        Position.create(passage.scope.start.line + 1, 0),
        passage.scope.end
    );
    const passageTextOffset = document.offsetAt(passageTextScope.start);
    const passageText = document.getText(passageTextScope);
    let i: number | undefined = offset - passageTextOffset;

    // Split the passage text into the vars and content sections
    const passageParts = divideChapbookPassage(passageText);

    // If we're inside the vars section, suggest variables
    if (i < passageParts.contentIndex) {
        return generateVariableAndPropertyCompletions(
            document,
            passageText.slice(0, i),
            passageTextOffset,
            index
        );
    }

    // If we're in a JavaScript embedded document, that's due
    // to a [JavaScript] modifier, and we shouldn't try to create
    // any modifier or insert completions
    for (const embeddedDocument of deferredEmbeddedDocuments) {
        if (embeddedDocument.document.languageId === "javascript") {
            return null;
        }
    }

    // See if we're inside a modifier or insert
    i = findStartOfModifierOrInsert(passageText, i);
    if (i !== undefined) {
        if (passageText[i] === "[") {
            return generateModifierCompletions(
                document,
                passageTextOffset + i + 1,
                offset,
                index
            );
        } else if (passageText[i] === "{") {
            return generateInsertCompletions(
                document,
                passageTextOffset + i + 1,
                offset,
                index
            );
        }
    }

    return null;
}
