import {
    Diagnostic,
    DiagnosticRelatedInformation,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import {
    createDiagnosticFromRange,
    DiagnosticCode,
    DiagnosticCodes,
} from "./diagnostics";
import { doValidation } from "./embedded-languages";
import { getStoryFormatParser } from "./passage-text-parsers";
import { ProjectIndex, References, TwineSymbolKind } from "./project-index";
import { comparePositions, containingRange } from "./utilities";

/**
 * Create diagnostics from references.
 *
 * @param index Project index.
 * @param refs References.
 * @param code Diagnostic code to apply.
 * @param message Optional diagnostic message.
 * @returns Diagnostics.
 */
export function referencesToDiagnostics(
    index: ProjectIndex,
    refs: References,
    code: DiagnosticCode,
    message?: string,
): Diagnostic[] {
    return refs.locations
        .filter((loc) => !index.diagnosticIsDisabled(loc.uri, code, loc.range))
        .map((loc) => createDiagnosticFromRange(code, loc.range, message));
}

/**
 * Validate a document's passages.
 *
 * @param document Document to validate.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
function validatePassages(
    document: TextDocument,
    index: ProjectIndex,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const documentPassages = index.getPassages(document.uri);
    const passageNames = index.getPassageNames();

    for (const passage of documentPassages ?? []) {
        // Since passage names are sorted, we can see if the first
        // instance of a passage's name is followed by another
        const ndx = passageNames.indexOf(passage.name.contents);
        if (
            ndx !== -1 &&
            passageNames[ndx + 1] === passage.name.contents &&
            !index.diagnosticIsDisabled(
                document.uri,
                DiagnosticCodes.MultiplePassageDefinitions,
                passage.name.location.range,
            )
        ) {
            const matchingPassages = index.getPassage(passage.name.contents);
            let otherPassage = matchingPassages[0];
            if (
                otherPassage.name.location.uri === passage.name.location.uri &&
                comparePositions(
                    otherPassage.name.location.range.start,
                    passage.name.location.range.start,
                ) === 0 &&
                comparePositions(
                    otherPassage.name.location.range.end,
                    passage.name.location.range.end,
                ) === 0 &&
                matchingPassages.length > 1
            ) {
                otherPassage = matchingPassages[1];
            }
            const diagnostic = createDiagnosticFromRange(
                DiagnosticCodes.MultiplePassageDefinitions,
                passage.name.location.range,
            );
            diagnostic.relatedInformation = [
                DiagnosticRelatedInformation.create(
                    otherPassage.name.location,
                    `Other creation of passage "${passage.name.contents}"`,
                ),
            ];
            diagnostics.push(diagnostic);
        }
    }

    return diagnostics;
}

/**
 * Validate a document's references to Twine passages.
 *
 * @param document Document to validate.
 * @param index Index of the Twine project.
 * @returns List of diagnostic messages.
 */
function validatePassageReferences(
    document: TextDocument,
    index: ProjectIndex,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const references =
        index.getReferences(document.uri, TwineSymbolKind.Passage) ?? [];
    const names = index.getPassageNames();
    for (const ref of references) {
        if (!names.includes(ref.contents)) {
            for (const loc of ref.locations) {
                if (
                    !index.diagnosticIsDisabled(
                        loc.uri,
                        DiagnosticCodes.MissingPassage,
                        loc.range,
                    )
                ) {
                    diagnostics.push(
                        createDiagnosticFromRange(
                            DiagnosticCodes.MissingPassage,
                            loc.range,
                        ),
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
 * @returns List of diagnostic messages.
 */
export async function generateDiagnostics(
    document: TextDocument,
    index: ProjectIndex,
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
                document.offsetAt(embeddedDocument.range.start),
            );
            diagnostics.push(diagnostic);
        }
    }

    // Validate passages
    diagnostics.push(...validatePassages(document, index));

    // Validate passage references
    diagnostics.push(...validatePassageReferences(document, index));

    // If we have a story format, let it generate its own diagnostics
    diagnostics.push(
        ...(getStoryFormatParser(
            index.getStoryData()?.storyFormat,
        )?.generateDiagnostics(document, index) ?? []),
    );

    return diagnostics;
}
