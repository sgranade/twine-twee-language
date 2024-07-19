import {
    Diagnostic,
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { doValidation } from "./embedded-languages";
import { ProjectIndex, TwineSymbolKind } from "./project-index";
import { getStoryFormatParser } from "./passage-text-parsers";
import { DiagnosticsOptions } from "./server-options";
import { comparePositions, containingRange } from "./utilities";

/**
 * Validate a document's passages.
 *
 * @param document Document to validate.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
function validatePassages(
    document: TextDocument,
    index: ProjectIndex
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const documentPassages = index.getPassages(document.uri);
    const passageNames = index.getPassageNames();

    for (const passage of documentPassages || []) {
        if (
            passageNames.indexOf(passage.name.contents) !=
            passageNames.lastIndexOf(passage.name.contents)
        ) {
            const matchingPassages = index.getPassage(passage.name.contents);
            let otherPassage = matchingPassages[0];
            if (
                otherPassage.name.location.uri === passage.name.location.uri &&
                comparePositions(
                    otherPassage.name.location.range.start,
                    passage.name.location.range.start
                ) === 0 &&
                comparePositions(
                    otherPassage.name.location.range.end,
                    passage.name.location.range.end
                ) === 0 &&
                matchingPassages.length > 1
            ) {
                otherPassage = matchingPassages[1];
            }
            diagnostics.push(
                Diagnostic.create(
                    passage.name.location.range,
                    `Passage "${passage.name.contents}" was defined elsewhere`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    undefined,
                    [
                        DiagnosticRelatedInformation.create(
                            otherPassage.name.location,
                            `Other creation of passage "${passage.name.contents}"`
                        ),
                    ]
                )
            );
        }
    }

    return diagnostics;
}

/**
 * Validate a document's references to Twine passages.
 *
 * @param document Document to validate.
 * @param index Index of the Twine project.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
function validatePassageReferences(
    document: TextDocument,
    index: ProjectIndex,
    diagnosticsOptions: DiagnosticsOptions
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (diagnosticsOptions.warnings.unknownPassage) {
        const references =
            index.getReferences(document.uri, TwineSymbolKind.Passage) || [];
        const names = index.getPassageNames();
        for (const ref of references) {
            if (!names.includes(ref.contents)) {
                for (const loc of ref.locations) {
                    diagnostics.push(
                        Diagnostic.create(
                            loc.range,
                            `Cannot find passage '${ref.contents}'`,
                            DiagnosticSeverity.Warning,
                            undefined,
                            "Twine"
                        )
                    );
                }
            }
        }
    }

    return diagnostics;
}

/**
 * Validate a text file and generate diagnostics against it.
 *
 * @param document Document to validate and generate diagnostics against.
 * @param index Index of the Twine project.
 * @param diagnosticsOptions Options for what optional diagnostics to report.
 * @returns List of diagnostic messages.
 */
export async function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
    diagnosticsOptions: DiagnosticsOptions
): Promise<Diagnostic[]> {
    // Start with parse errors
    const diagnostics: Diagnostic[] = [...index.getParseErrors(document.uri)];

    // Add diagnostics from embedded documents
    for (const embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        const newDiagnostics = await doValidation(embeddedDocument);
        for (const diagnostic of newDiagnostics) {
            diagnostic.range = containingRange(
                embeddedDocument.document,
                diagnostic.range,
                document,
                document.offsetAt(embeddedDocument.range.start)
            );
            diagnostics.push(diagnostic);
        }
    }

    // Validate passages
    diagnostics.push(...validatePassages(document, index));

    // Validate passage references
    diagnostics.push(
        ...validatePassageReferences(document, index, diagnosticsOptions)
    );

    // If we have a story format, let it generate its own diagnostics
    diagnostics.push(
        ...(getStoryFormatParser(
            index.getStoryData()?.storyFormat
        )?.generateDiagnostics(document, index, diagnosticsOptions) || [])
    );

    return diagnostics;
}
