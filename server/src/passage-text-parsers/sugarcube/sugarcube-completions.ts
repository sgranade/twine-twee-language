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
import { allMacros } from "./macros";
import { getSugarCubeDefinitions } from "./sugarcube-parser";
import { OSugarCubeSymbolKind, SugarCubeSymbol } from "./types";

/**
 * Generate completions for variables and properties.
 * @param document Document in which to generate the completions.
 * @param text Text from the start of the possible variable to the point where completions are to be generated.
 * @param textOffset Offset for the text in the document.
 * @param index Project index.
 * @returns Completions list.
 */
function generateVariableAndPropertyCompletions(
    document: TextDocument,
    text: string,
    textOffset: number,
    index: ProjectIndex
): CompletionList | null {
    const completions: string[] = [];

    // If there's a period and then variable characters at the end of the string, assume we're being
    // asked to generate properties. Only get ones that match the full context (like $var1.prop)
    const m = /([$_]\w+\.(\w+\.)*)(\w*)$/.exec(text);
    const context = m === null ? undefined : m[1];
    const range =
        m === null
            ? undefined
            : Range.create(
                  document.positionAt(textOffset + text.length - m[3].length),
                  document.positionAt(textOffset + text.length)
              );
    for (const uri of index.getIndexedUris()) {
        if (context !== undefined) {
            // Get all properties whose contents match the full context
            completions.push(
                ...(index
                    .getReferences(uri, OSugarCubeSymbolKind.Property)
                    ?.filter((ref) => ref.contents.startsWith(context))
                    .map(
                        (ref) => ref.contents.split(".").pop() ?? ref.contents
                    ) ?? [])
            );
        } else {
            // Get all variables that start with the same sigil ($ or _)
            completions.push(
                ...(index
                    .getReferences(uri, OSugarCubeSymbolKind.Variable)
                    ?.filter((x) => x.contents.startsWith(text[0]))
                    .map((x) => x.contents) ?? [])
            );
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
        const completionList = CompletionList.create(
            Array.from(new Set<string>(completions)).map((c) => {
                return {
                    label: c,
                    kind: CompletionItemKind.Variable,
                    textEditText: c,
                };
            })
        );
        completionList.itemDefaults = {
            editRange: Range.create(
                document.positionAt(textOffset),
                document.positionAt(textOffset + text.length)
            ),
        };
        return completionList;
    }
}

/**
 * Generate completions to close a SugarCube container <<macro>>.
 *
 * @param text Text from the start of the line to the point where completions will go.
 * @returns Completion list.
 */
function generateMacroContainerCloseCompletions(
    text: string
): CompletionList | null {
    // Find the start and end of the macro name
    let macroNameStart: number | undefined;
    let macroNameEnd: number | undefined;
    for (
        let i = text.length - 2 /* skip the closing ">>" */;
        i > 0 /* since we need two "<<" */;
        --i
    ) {
        if (text[i] === "<" && text[i - 1] === "<") {
            macroNameStart = i + 1;
            break;
        }

        // Keep track of the possible end of the macro name
        if (/\w/.test(text[i])) {
            if (macroNameEnd === undefined) {
                macroNameEnd = i + 1;
            }
        } else {
            macroNameEnd = undefined;
        }
    }
    if (macroNameStart === undefined || macroNameEnd === undefined) {
        return null; // No macro name found
    }

    // Get the possible matching macroInfo
    const macroInfo = allMacros()[text.slice(macroNameStart, macroNameEnd)];
    if (macroInfo === undefined) {
        return null; // No matching macro found
    }
    return CompletionList.create([
        {
            label: `<</${macroInfo.name}>>`,
            kind: CompletionItemKind.Function,
        },
    ]);
}

/**
 * Generate completions for a SugarCube <<macro>>.
 *
 * @param document Document in which to generate the completions.
 * @param text Text from the start of the macro (inside the <<) to the end of the line.
 * @param textOffset Offset for the start of the text in the document.
 * @param completionPointOffset Where the completion occurs *relative to the start of the text string*.
 * @param index Project index.
 * @returns Completions list.
 */
function generateMacroNameCompletions(
    document: TextDocument,
    text: string,
    textOffset: number,
    completionPointOffset: number,
    index: ProjectIndex
): CompletionList | null {
    const completions: CompletionItem[] = [];

    // See if there's any text after the completion point
    let macroNameEnd = completionPointOffset;
    for (; macroNameEnd < text.length; ++macroNameEnd) {
        if (!/\w/.test(text[macroNameEnd])) {
            break;
        }
    }
    const partialMacroName = text.slice(0, macroNameEnd);

    // Find out how much we should replace for macros that are containers
    // (if any -- we don't add a closing macro if the text is e.g. "<<macroName stuff>>")
    const closingBracketsIndex = text.indexOf(">>", macroNameEnd);
    let containerMacroReplacementRange: Range | undefined;
    // No closing brackets, so just replace the text before the "<<"
    if (closingBracketsIndex === -1) {
        containerMacroReplacementRange = Range.create(
            document.positionAt(textOffset),
            document.positionAt(textOffset + macroNameEnd)
        );
    } else {
        // Only add a closing macro if there's no text between the macro name and the >>
        const middleText = text.slice(macroNameEnd, closingBracketsIndex);
        if (middleText.length === 0 || /^\s+$/.test(middleText)) {
            containerMacroReplacementRange = Range.create(
                document.positionAt(textOffset),
                document.positionAt(textOffset + closingBracketsIndex + 2) // + 2 to include the >>
            );
        }
    }

    // Add known macros
    completions.push(
        ...Object.values(allMacros())
            .filter((info) => info.name.startsWith(partialMacroName))
            .map((info) => {
                const completionItem: CompletionItem = {
                    label: info.name,
                    kind: CompletionItemKind.Function,
                };
                if (
                    info.container &&
                    containerMacroReplacementRange !== undefined
                ) {
                    completionItem.insertTextFormat = InsertTextFormat.Snippet;
                    // Add a closing container macro. Tab stop position depends on whether or not there are arguments
                    if (info.arguments) {
                        completionItem.textEdit = TextEdit.replace(
                            containerMacroReplacementRange,
                            `${info.name} \${0}>><</${info.name}>>`
                        );
                    } else {
                        completionItem.textEdit = TextEdit.replace(
                            containerMacroReplacementRange,
                            `${info.name}>>\${0}<</${info.name}>>`
                        );
                    }
                }
                return completionItem;
            })
    );

    // Add macro definitions
    completions.push(
        ...getSugarCubeDefinitions(OSugarCubeSymbolKind.KnownMacro, index)
            .filter((def) => def.contents.startsWith(partialMacroName))
            .map((def) => {
                const completionItem: CompletionItem = {
                    label: def.contents,
                    kind: CompletionItemKind.Function,
                };
                if (
                    (def as SugarCubeSymbol).container &&
                    containerMacroReplacementRange !== undefined
                ) {
                    completionItem.insertTextFormat = InsertTextFormat.Snippet;
                    // Add a closing container macro.
                    completionItem.textEdit = TextEdit.replace(
                        containerMacroReplacementRange,
                        `${def.contents}>>\${0}<</${def.contents}>>`
                    );
                }
                return completionItem;
            })
    );

    if (completions.length > 0) {
        // Get rid of duplicates in case of overlaps between known macros (via T3LT
        // definition files) and macro definitions (from <<widget>> macros)
        const seenCompletions: Set<string> = new Set();
        const completionList = CompletionList.create(
            completions.filter((c) => {
                if (seenCompletions.has(c.label)) {
                    return false;
                }
                seenCompletions.add(c.label);
                return true;
            })
        );
        completionList.itemDefaults = {
            editRange: Range.create(
                document.positionAt(textOffset),
                document.positionAt(textOffset + macroNameEnd)
            ),
        };
        return completionList;
    }

    return null;
}

export function generateCompletions(
    document: TextDocument,
    position: Position,
    deferredEmbeddedDocuments: EmbeddedDocument[],
    index: ProjectIndex
): CompletionList | null {
    const lineStartPosition = Position.create(position.line, 0);
    const lineEndPosition = Position.create(position.line + 1, 0);
    const lineOffset = document.offsetAt(lineStartPosition);
    const completionRelativeOffset = document.offsetAt(position) - lineOffset; // Relative to the start of the line
    const line = document.getText(
        Range.create(lineStartPosition, lineEndPosition)
    );

    let i = completionRelativeOffset - 1;
    // If we're at a macro close (>>), generate matching close macros for containers
    if (i > 1 && line[i] === ">" && line[i - 1] === ">") {
        return generateMacroContainerCloseCompletions(line.slice(0, i + 1));
    }
    // Look backwards for the start of macros (<<), variables ($, _), or possible object properties (.)
    for (; i >= 0; --i) {
        if (line[i] === "$" || line[i] === "_") {
            return generateVariableAndPropertyCompletions(
                document,
                line.slice(i, completionRelativeOffset),
                lineOffset + i,
                index
            );
        }
        if (line[i] === "<" && i >= 1 && line[i - 1] === "<") {
            return generateMacroNameCompletions(
                document,
                line.slice(i + 1),
                lineOffset + i + 1,
                completionRelativeOffset - (i + 1),
                index
            );
        }
        // Once we run out of word characters or periods, bail
        if (line[i] !== "." && !/\w/.test(line[i])) {
            break;
        }
    }

    return null;
}
