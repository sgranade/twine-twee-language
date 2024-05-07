import { CompletionList, Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    JSONDocument,
    getLanguageService as getJSONLanguageService,
} from "vscode-json-languageservice";

import { headerMetadataSchema, storyDataSchema } from "./language";

/**
 * A document embedded inside another.
 */
export interface EmbeddedDocument {
    document: TextDocument; // Raw document
    offset: number; // Where the embedded document begins inside its parent (zero-based)
    languageId: string; // ID of the embedded document's language
}

/**
 * Get a list of completions.
 *
 * @param embeddedDocument Embedded document.
 * @param offset Offset in the parent document where completions are being requested (zero-based).
 * @returns List of completions.
 */
export async function doComplete(
    embeddedDocument: EmbeddedDocument,
    offset: number
): Promise<CompletionList | null> {
    const service = getLanguageService(embeddedDocument.languageId);
    return (await service?.doComplete(embeddedDocument, offset)) || null;
}

/**
 * Validate an embedded document.
 *
 * @param embeddedDocument Embedded document.
 * @returns List of diagnostic messages.
 */
export async function doValidation(
    embeddedDocument: EmbeddedDocument
): Promise<Diagnostic[]> {
    const service = getLanguageService(embeddedDocument.languageId);
    return (await service?.doValidation(embeddedDocument)) || [];
}

/**
 * Language service for an embedded language.
 */
interface LanguageService {
    /**
     * Get a list of completions.
     *
     * @param embeddedDocument Embedded document.
     * @param offset Offset in the parent document where completions are being requested (zero-based).
     * @returns List of completions.
     */
    doComplete: (
        embeddedDocument: EmbeddedDocument,
        offset: number
    ) => Thenable<CompletionList | null>;
    /**
     * Validate an embedded document.
     *
     * @param embeddedDocument Embedded document.
     * @returns List of diagnostic messages.
     */
    doValidation: (
        embeddedDocument: EmbeddedDocument
    ) => Thenable<Diagnostic[]>;
}

function getLanguageService(id: string): LanguageService | undefined {
    if (id === "json") {
        return jsonService;
    }

    return undefined;
}

/* JSON */

const storyDataSchemaUri = "file:///storydata.schema.json";
const headerMetadataSchemaUri = "file:///headermetadata.schema.json";
export const storyDataJSONUri = "file:///storydata.json";
export const headerMetadataJSONUri = "file:///headermetadata.json";
const jsonLanguageService = getJSONLanguageService({
    schemaRequestService: (uri) => {
        if (uri === storyDataSchemaUri) {
            return Promise.resolve(storyDataSchema);
        }
        if (uri === headerMetadataSchemaUri) {
            return Promise.resolve(headerMetadataSchema);
        }
        return Promise.reject(`Unabled to load schema at ${uri}`);
    },
});
jsonLanguageService.configure({
    schemas: [
        { fileMatch: ["*/storydata.json"], uri: storyDataSchemaUri },
        { fileMatch: ["*/headermetadata.json"], uri: headerMetadataSchemaUri },
    ],
});

/**
 * Parse a JSON document.
 *
 * @param document Document to parse.
 * @returns Parsed JSON document.
 */
export function parseJSON(document: TextDocument): JSONDocument {
    return jsonLanguageService.parseJSONDocument(document);
}

// TODO right now the language services re-parse on every validation and completion.
// If this becomes a time suck, consider cacheing the results

const jsonService: LanguageService = {
    doComplete(embeddedDocument: EmbeddedDocument, offset: number) {
        return jsonLanguageService.doComplete(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(
                offset - embeddedDocument.offset
            ),
            parseJSON(embeddedDocument.document)
        );
    },

    doValidation(embeddedDocument: EmbeddedDocument) {
        return jsonLanguageService.doValidation(
            embeddedDocument.document,
            parseJSON(embeddedDocument.document)
        );
    },
};
