import { CompletionList, Diagnostic, Hover } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    JSONDocument,
    getLanguageService as getJSONLanguageService,
} from "vscode-json-languageservice";
import { getCSSLanguageService } from "vscode-css-languageservice";

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
 * Get hover information.
 *
 * @param embeddedDocument Embedded document.
 * @param offset Offset in the parent document where completions are being requested (zero-based).
 * @returns Hover information.
 */
export async function doHover(
    embeddedDocument: EmbeddedDocument,
    offset: number
): Promise<Hover | null | undefined> {
    const service = getLanguageService(embeddedDocument.languageId);
    return await service?.doHover(embeddedDocument, offset);
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
    return service?.doValidation(embeddedDocument) || [];
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
    ) => Promise<CompletionList | null>;
    doHover: (
        embeddedDocument: EmbeddedDocument,
        offset: number
    ) => Promise<Hover | null>;
    /**
     * Validate an embedded document.
     *
     * @param embeddedDocument Embedded document.
     * @returns List of diagnostic messages.
     */
    doValidation: (embeddedDocument: EmbeddedDocument) => Promise<Diagnostic[]>;
}

function getLanguageService(id: string): LanguageService | undefined {
    if (id === "json") {
        return jsonService;
    }
    if (id === "css") {
        return cssService;
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
    async doComplete(embeddedDocument, offset) {
        return await jsonLanguageService.doComplete(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(
                offset - embeddedDocument.offset
            ),
            parseJSON(embeddedDocument.document)
        );
    },

    async doHover(embeddedDocument, offset) {
        return await jsonLanguageService.doHover(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(
                offset - embeddedDocument.offset
            ),
            parseJSON(embeddedDocument.document)
        );
    },

    async doValidation(embeddedDocument) {
        return await jsonLanguageService.doValidation(
            embeddedDocument.document,
            parseJSON(embeddedDocument.document)
        );
    },
};

/* CSS */

const cssLanguageService = getCSSLanguageService();

// TODO right now the language services re-parse on every validation and completion.
// If this becomes a time suck, consider cacheing the results

const cssService: LanguageService = {
    async doComplete(embeddedDocument, offset) {
        const stylesheet = cssLanguageService.parseStylesheet(
            embeddedDocument.document
        );
        return cssLanguageService.doComplete(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(
                offset - embeddedDocument.offset
            ),
            stylesheet
        );
    },

    async doHover(embeddedDocument, offset) {
        const stylesheet = cssLanguageService.parseStylesheet(
            embeddedDocument.document
        );
        return cssLanguageService.doHover(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(
                offset - embeddedDocument.offset
            ),
            stylesheet
        );
    },

    async doValidation(embeddedDocument) {
        const stylesheet = cssLanguageService.parseStylesheet(
            embeddedDocument.document
        );
        return cssLanguageService.doValidation(
            embeddedDocument.document,
            stylesheet
        );
    },
};
