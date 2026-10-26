import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCodes } from "@tt3/shared";
import { isBuiltinJSProperty } from "../../js-parser";
import { ProjectIndex } from "../../project-index";
import { referencesToDiagnostics } from "../../validator";
import {
    findEndOfPartialInsert,
    findEndOfPartialModifier,
    findStartOfModifierOrInsert,
    getChapbookDefinitions,
    tokenizeInsert,
    tokenizeModifier,
    validateFunctionAndFirstArgument,
    validateInsertContents,
} from "./chapbook-parser";
import { chapbookProperties } from "./chapbook-properties";
import { OChapbookSymbolKind } from "./types";

const builtinVars = [
    ...new Set(chapbookProperties.map((x) => x.split(".", 1)[0])),
];

/**
 * Generate diagnostics involving custom inserts.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param text Text of the document.
 * @returns List of diagnostic messages.
 */
function generateCustomInsertDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    text: string,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const customInserts = getChapbookDefinitions(
        OChapbookSymbolKind.CustomInsert,
        index,
    );
    for (const insertRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.CustomInsert,
    ) ?? []) {
        const insert = customInserts.find((i) =>
            i.match.test(insertRef.contents),
        );
        if (insert !== undefined) {
            // We need to re-parse the custom insert and check for errors
            // if we have information about that custom insert's arguments
            if (
                insert.firstArgument === undefined &&
                insert.requiredProps === undefined &&
                insert.optionalProps === undefined
            )
                continue;

            for (const loc of insertRef.locations) {
                // Find the start of the insert
                const startNdx = findStartOfModifierOrInsert(
                    text,
                    document.offsetAt(loc.range.start),
                );
                if (startNdx === undefined) continue;

                // Extract the insert
                const endNdx = findEndOfPartialInsert(text, startNdx);
                if (endNdx === undefined) continue;
                const insertText = text.substring(startNdx, endNdx + 1);

                // Tokenize the insert and validate its arguments
                const insertTokens = tokenizeInsert(insertText, startNdx);
                diagnostics.push(
                    ...index.reduceDiagnostics(
                        document.uri,
                        validateInsertContents(
                            insert,
                            insertTokens,
                            document,
                            index.getStoryData()?.storyFormat?.formatVersion,
                        ),
                    ),
                );
            }
        } else {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    insertRef,
                    DiagnosticCodes.ChapbookUnknownInsert,
                ),
            );
        }
    }

    return diagnostics;
}

/**
 * Generate diagnostics involving custom modifiers.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param text Text of the document.
 * @returns List of diagnostic messages.
 */
function generateCustomModifierDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    text: string,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const customModifiers = getChapbookDefinitions(
        OChapbookSymbolKind.CustomModifier,
        index,
    );
    for (const modRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.CustomModifier,
    ) ?? []) {
        const modifier = customModifiers.find((i) =>
            i.match.test(modRef.contents),
        );
        if (modifier !== undefined) {
            // We only validate arguments if the modifier has ones defined
            if (modifier.firstArgument === undefined) continue;

            for (const loc of modRef.locations) {
                // Find the start of the modifier
                let startNdx = findStartOfModifierOrInsert(
                    text,
                    document.offsetAt(loc.range.start),
                );
                if (startNdx === undefined) continue;

                const endNdx = findEndOfPartialModifier(text, startNdx);
                if (endNdx === undefined) continue;
                startNdx++; // To skip the opening "["
                const modText = text.substring(startNdx, endNdx);

                const modTokens = tokenizeModifier(modText, startNdx, modifier);
                if (modTokens !== undefined) {
                    diagnostics.push(
                        ...index.reduceDiagnostics(
                            document.uri,
                            validateFunctionAndFirstArgument(
                                modifier,
                                modTokens.name,
                                modTokens.firstArgument,
                                index.getStoryData()?.storyFormat
                                    ?.formatVersion,
                                document,
                            ),
                        ),
                    );
                }
            }
        } else {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    modRef,
                    DiagnosticCodes.ChapbookUnknownModifier,
                ),
            );
        }
    }

    return diagnostics;
}

/**
 * Generate Chapbook-specific diagnostics.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
export function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const text = document.getText();

    // Check for variables and properties that don't have a matching set statement in a vars section
    const propSetNamesWithDuplicates: string[] = [...chapbookProperties];
    for (const uri of index.getIndexedUris()) {
        propSetNamesWithDuplicates.push(
            ...(index
                .getReferences(uri, OChapbookSymbolKind.PropertySet)
                ?.map((ref) => ref.contents) ?? []),
        );
    }
    const propSetNames = new Set(propSetNamesWithDuplicates);

    const varNamesWithDuplicates = [...builtinVars];
    for (const uri of index.getIndexedUris()) {
        varNamesWithDuplicates.push(
            ...(index
                .getReferences(uri, OChapbookSymbolKind.VariableSet)
                ?.map((ref) => ref.contents) ?? []),
        );
    }
    const varSetNames = new Set(varNamesWithDuplicates);

    const unsetVarMessage =
        "This isn't set in any vars or JavaScript section; make sure it's spelled correctly";
    for (const varRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.Variable,
    ) ?? []) {
        if (!varSetNames.has(varRef.contents)) {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    varRef,
                    DiagnosticCodes.VariableNeverSet,
                    unsetVarMessage,
                ),
            );
        }
    }
    for (const propRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.Property,
    ) ?? []) {
        if (
            !propSetNames.has(propRef.contents) &&
            !isBuiltinJSProperty(propRef)
        ) {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    propRef,
                    DiagnosticCodes.VariableNeverSet,
                    unsetVarMessage,
                ),
            );
        }
    }

    // Check for unrecognized custom inserts (if that option is set) and
    // any argument errors in recognized custom inserts
    diagnostics.push(...generateCustomInsertDiagnostics(document, index, text));

    diagnostics.push(
        ...generateCustomModifierDiagnostics(document, index, text),
    );

    return diagnostics;
}
