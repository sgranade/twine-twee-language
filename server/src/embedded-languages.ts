import {
    CompletionList,
    Diagnostic,
    Hover,
    Range,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";
import {
    JSONDocument,
    getLanguageService as getJSONLanguageService,
} from "vscode-json-languageservice";
import { getCSSLanguageService } from "vscode-css-languageservice";
import { getLanguageService as getHtmlLanguageService } from "vscode-html-languageservice";

import { headerMetadataSchema, storyDataSchema } from "./language";

/**
 * A document embedded inside another.
 */
export interface EmbeddedDocument {
    document: TextDocument; // Raw document
    range: Range; // Range in the parent that the embedded document encompasses
    isPassage: boolean; // Does the embedded document encompass an entire Twine passage? (This affects completions, hover info, &c.)
}
export namespace EmbeddedDocument {
    /**
     * Create a new Embedded Document literal.
     *
     * @param uri The document's uri.
     * @param languageId  The document's language Id.
     * @param content The document's content.
     * @param offset Where the embedded document begins inside its parent (zero-based).
     * @param parent Parent document the embedded document lives inside.
     * @param isPassage If the document corresponds to an entire Twine passage (which affects completions, hover info, &c.)
     * @returns A new embedded document.
     */
    export function create(
        uri: string,
        languageId: string,
        content: string,
        offset: number,
        parent: TextDocument,
        isPassage?: boolean
    ): EmbeddedDocument {
        if (isPassage === undefined) isPassage = false;
        return {
            document: TextDocument.create(
                uri,
                languageId,
                parent.version,
                content
            ),
            range: Range.create(
                parent.positionAt(offset),
                parent.positionAt(offset + content.length)
            ),
            isPassage: isPassage,
        };
    }
}

/**
 * Update an embedded document if its parents' contents have changed.
 *
 * Note that, if the changes alter the embedded document's actual
 * range in the parent document, then this won't work. We'll accept
 * this compromise since otherwise we'd have to re-parse the entire
 * parent.
 *
 * @param embeddedDocument Embedded document to update.
 * @param parent Parent document that contains the embedded document.
 * @returns Updated embedded document.
 */
export function updateEmbeddedDocument(
    embeddedDocument: EmbeddedDocument,
    parent: TextDocument
): EmbeddedDocument {
    if (parent.version > embeddedDocument.document.version) {
        embeddedDocument = EmbeddedDocument.create(
            embeddedDocument.document.uri,
            embeddedDocument.document.languageId,
            parent.getText(embeddedDocument.range),
            parent.offsetAt(embeddedDocument.range.start),
            parent,
            embeddedDocument.isPassage
        );
    }
    return embeddedDocument;
}

/**
 * Get a list of completions.
 *
 * @param parentDocument Parent document that contains the embedded document.
 * @param embeddedDocument Embedded document.
 * @param offset Offset in the parent document where completions are being requested (zero-based).
 * @returns List of completions.
 */
export async function doComplete(
    parentDocument: TextDocument,
    embeddedDocument: EmbeddedDocument,
    offset: number
): Promise<CompletionList | null> {
    const embeddedOffset =
        offset - parentDocument.offsetAt(embeddedDocument.range.start);
    const service = getLanguageService(embeddedDocument.document.languageId);
    return (
        (await service?.doComplete(embeddedDocument, embeddedOffset)) ?? null
    );
}

/**
 * Get hover information.
 *
 * @param parentDocument Parent document that contains the embedded document.
 * @param embeddedDocument Embedded document.
 * @param offset Offset in the parent document where completions are being requested (zero-based).
 * @returns Hover information.
 */
export async function doHover(
    parentDocument: TextDocument,
    embeddedDocument: EmbeddedDocument,
    offset: number
): Promise<Hover | null | undefined> {
    const embeddedOffset =
        offset - parentDocument.offsetAt(embeddedDocument.range.start);
    const service = getLanguageService(embeddedDocument.document.languageId);
    return await service?.doHover(embeddedDocument, embeddedOffset);
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
    const service = getLanguageService(embeddedDocument.document.languageId);
    return service?.doValidation(embeddedDocument) ?? [];
}

/**
 * Language service for an embedded language.
 */
interface LanguageService {
    /**
     * Get a list of completions.
     *
     * @param embeddedDocument Embedded document.
     * @param offset Offset in the embedded document where completions are being requested (zero-based).
     * @returns List of completions.
     */
    doComplete: (
        embeddedDocument: EmbeddedDocument,
        offset: number
    ) => Promise<CompletionList | null>;
    /**
     * Get hover information.
     *
     * @param embeddedDocument Embedded document.
     * @param offset Offset in the document where hover info is being requested (zero-based).
     * @returns Hover information.
     */
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
    if (id === "html") {
        return htmlService;
    }

    return undefined;
}

/* JSON */

const jsonUriToFileRegex: Record<string, string[]> = {};
const jsonUriToSchema: Record<string, string> = {};

const storyDataSchemaUri = "file:///storydata.schema.json";
const headerMetadataSchemaUri = "file:///headermetadata.schema.json";
export const storyDataJSONUri = "file:///storydata.json";
export const headerMetadataJSONUri = "file:///headermetadata.json";

const jsonLanguageService = getJSONLanguageService({
    schemaRequestService: (uri) => {
        const schema = jsonUriToSchema[uri];
        if (schema !== undefined) return Promise.resolve(schema);

        return Promise.reject(`Unabled to load schema at ${uri}`);
    },
});

/**
 * Add a JSON schema to the JSON language service.
 *
 * @param uri URI for the schema (typically `file:///<filename>.schema.json`)
 * @param fileRegex Regex for files that should have the schema applied to them.
 * @param schema Schema as a string.
 */
export function addJsonSchema(
    uri: string,
    fileRegex: string[],
    schema: string
) {
    jsonUriToFileRegex[uri] = fileRegex;
    jsonUriToSchema[uri] = schema;

    jsonLanguageService.configure({
        schemas: Object.entries(jsonUriToFileRegex).map(([uri, regexes]) => {
            return { fileMatch: regexes, uri: uri };
        }),
    });
}

addJsonSchema(storyDataSchemaUri, ["*/storydata.json"], storyDataSchema);
addJsonSchema(
    headerMetadataSchemaUri,
    ["*/headermetadata.json"],
    headerMetadataSchema
);

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
            embeddedDocument.document.positionAt(offset),
            parseJSON(embeddedDocument.document)
        );
    },

    async doHover(embeddedDocument, offset) {
        return await jsonLanguageService.doHover(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(offset),
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
            embeddedDocument.document.positionAt(offset),
            stylesheet
        );
    },

    async doHover(embeddedDocument, offset) {
        const stylesheet = cssLanguageService.parseStylesheet(
            embeddedDocument.document
        );
        return cssLanguageService.doHover(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(offset),
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

/* HTML */

const htmlLanguageService = getHtmlLanguageService();

// TODO right now the language services re-parse on every validation and completion.
// If this becomes a time suck, consider cacheing the results

const htmlService: LanguageService = {
    async doComplete(embeddedDocument, offset) {
        return htmlLanguageService.doComplete(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(offset),
            htmlLanguageService.parseHTMLDocument(embeddedDocument.document)
        );
    },

    async doHover(embeddedDocument, offset) {
        return htmlLanguageService.doHover(
            embeddedDocument.document,
            embeddedDocument.document.positionAt(offset),
            htmlLanguageService.parseHTMLDocument(embeddedDocument.document)
        );
    },

    async doValidation(embeddedDocument) {
        return [];
    },
};
