import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { createDiagnosticFromRange, DiagnosticCodes } from "../../diagnostics";
import { isBuiltinJSObjectInstanceProperty } from "../../js-parser";
import { ProjectIndex } from "../../project-index";
import { DiagnosticsOptions } from "../../server-options";
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
import { OChapbookSymbolKind } from "./types";

/**
 * Built-in variable properties in Chapbook.
 */
const chapbookProperties: readonly string[] = [
    "browser.darkTheme",
    "browser.darkSystemTheme",
    "browser.height",
    "browser.online",
    "browser.width",
    "config.backstage.trail.maxLength",
    "config.body.transition.duration",
    "config.body.transition.name",
    "config.footer.center",
    "config.footer.left",
    "config.footer.right",
    "config.footer.transition.duration",
    "config.footer.transition.name",
    "config.header.center",
    "config.header.left",
    "config.header.right",
    "config.header.transition.duration",
    "config.header.transition.name",
    "config.logger.show.parse",
    "config.logger.show.sound",
    "config.logger.show.state",
    "config.logger.show.story",
    "config.logger.show.style",
    "config.random.seed",
    "config.state.autosave",
    "config.style.backdrop",
    "config.style.dark.backdrop",
    "config.style.dark.page.color",
    "config.style.dark.page.footer.border",
    "config.style.dark.page.footer.borderColor",
    "config.style.dark.page.footer.link.active.color",
    "config.style.dark.page.fork.divider.color",
    "config.style.dark.page.header.border",
    "config.style.dark.page.header.borderColor",
    "config.style.dark.page.header.link.active.color",
    "config.style.dark.page.link.active.color",
    "config.style.dark.page.link.color",
    "config.style.dark.page.link.lineColor",
    "config.style.fontScaling.addAtDoubleWidth",
    "config.style.fontScaling.baseViewportWidth",
    "config.style.fontScaling.enabled",
    "config.style.page.color",
    "config.style.page.font",
    "config.style.page.footer.border",
    "config.style.page.footer.borderColor",
    "config.style.page.footer.font",
    "config.style.page.footer.link.active.color",
    "config.style.page.footer.link.active.font",
    "config.style.page.footer.link.active.lineColor",
    "config.style.page.footer.link.font",
    "config.style.page.footer.link.lineColor",
    "config.style.page.fork.divider.color",
    "config.style.page.fork.divider.size",
    "config.style.page.fork.divider.style",
    "config.style.page.header.border",
    "config.style.page.header.borderColor",
    "config.style.page.header.font",
    "config.style.page.header.link.active.color",
    "config.style.page.header.link.active.font",
    "config.style.page.header.link.active.lineColor",
    "config.style.page.header.link.font",
    "config.style.page.header.link.lineColor",
    "config.style.page.link.active.color",
    "config.style.page.link.color",
    "config.style.page.link.font",
    "config.style.page.link.lineColor",
    "config.style.page.style.border",
    "config.style.page.style.borderColor",
    "config.style.page.theme.enableSwitching",
    "config.style.page.theme.override",
    "config.style.page.verticalAlign",
    "config.testing",
    "engine.state",
    "engine.template",
    "engine.template.inserts",
    "engine.template.modifiers",
    "engine.version",
    "now.datestamp",
    "now.day",
    "now.hour",
    "now.minute",
    "now.month",
    "now.monthName",
    "now.second",
    "now.timestamp",
    "now.weekday",
    "now.weekdayName",
    "now.year",
    "passage.from",
    "passage.fromText",
    "passage.name",
    "passage.visits",
    "random.fraction",
    "random.d4",
    "random.d5",
    "random.d6",
    "random.d8",
    "random.d10",
    "random.d12",
    "random.d20",
    "random.d25",
    "random.d50",
    "random.d100",
    "sound.mute",
    "sound.transitionDuration",
    "sound.volume",
    "story.name",
    "trail",
];

const builtinVars = [
    ...new Set(chapbookProperties.map((x) => x.split(".", 1)[0])),
];

/**
 * Generate diagnostics involving custom inserts.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param text Text of the document.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
function generateCustomInsertDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    text: string,
    diagnosticsOptions: DiagnosticsOptions,
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
                    ...validateInsertContents(
                        insert,
                        insertTokens,
                        document,
                        index.getStoryData()?.storyFormat?.formatVersion,
                    ),
                );
            }
        } else if (diagnosticsOptions.warnings.unknownMacro) {
            diagnostics.push(
                ...insertRef.locations.map((loc) =>
                    createDiagnosticFromRange(
                        DiagnosticCodes.ChapbookUnknownInsert,
                        loc.range,
                    ),
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
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
function generateCustomModifierDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    text: string,
    diagnosticsOptions: DiagnosticsOptions,
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
                        ...validateFunctionAndFirstArgument(
                            modifier,
                            modTokens.name,
                            modTokens.firstArgument,
                            index.getStoryData()?.storyFormat?.formatVersion,
                            document,
                        ),
                    );
                }
            }
        } else if (diagnosticsOptions.warnings.unknownMacro) {
            diagnostics.push(
                ...modRef.locations.map((loc) =>
                    createDiagnosticFromRange(
                        DiagnosticCodes.ChapbookUnknownModifier,
                        loc.range,
                    ),
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
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
export function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    diagnosticsOptions: DiagnosticsOptions,
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

    for (const varRef of index.getReferences(
        document.uri,
        OChapbookSymbolKind.Variable,
    ) ?? []) {
        if (!varSetNames.has(varRef.contents)) {
            diagnostics.push(
                ...varRef.locations.map((loc) =>
                    createDiagnosticFromRange(
                        DiagnosticCodes.VariableNeverSet,
                        loc.range,
                        "This isn't set in any vars or JavaScript section; make sure it's spelled correctly",
                    ),
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
            !isBuiltinJSObjectInstanceProperty(propRef.contents)
        ) {
            diagnostics.push(
                ...propRef.locations.map((loc) =>
                    createDiagnosticFromRange(
                        DiagnosticCodes.VariableNeverSet,
                        loc.range,
                        "This isn't set in any vars or JavaScript section; make sure it's spelled correctly",
                    ),
                ),
            );
        }
    }

    // Check for unrecognized custom inserts (if that option is set) and
    // any argument errors in recognized custom inserts
    diagnostics.push(
        ...generateCustomInsertDiagnostics(
            document,
            index,
            text,
            diagnosticsOptions,
        ),
    );

    diagnostics.push(
        ...generateCustomModifierDiagnostics(
            document,
            index,
            text,
            diagnosticsOptions,
        ),
    );

    return diagnostics;
}
