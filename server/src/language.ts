/**
 * Regex to find the tags portion of a Twee 3 header.
 */
export const tagRegex = /\[(.*?)((?<!\\)\])\s*/;

/**
 * Regex to find an opening meta character in a Twee 3 header.
 */
export const openMetaCharRegex = /(?<!\\)(\{|\[)/;

/**
 * Regex to find all closing meta characters in a Twee 3 header.
 *
 * The regex is global and multi-line.
 */
export const closeMetaCharRegex = /(?<!\\)(\}|\])/gm;

/**
 * Regex to find the metadata portion of a Twee 3 header.
 */
export const metadataRegex = /(\{(.*?)((?<!\\)\}))\s*/;

/**
 * JSON schema for header metadata.
 */
export const headerMetadataSchema = JSON.stringify({
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
        position: {
            description: "Passage tile's position in the Twine 2 editor",
            type: "string",
            pattern: "^\\d+,\\d+",
            patternErrorMessage: 'Must be coordinates in the form "600,400"',
        },
        size: {
            description: "Passage tile's size in the Twine 2 editor",
            type: "string",
            pattern: "^\\d+,\\d+",
            patternErrorMessage: 'Must be a size in the form "100,200"',
        },
    },
    additionalProperties: false,
});

/**
 * JSON schema for Story Data.
 */
export const storyDataSchema = JSON.stringify({
    $schema: "http://json-schema.org/draft-04/schema#",
    type: "object",
    properties: {
        ifid: {
            description: "The IFID for the game",
            type: "string",
            pattern:
                "^[a-fA-F\\d]{8}-[a-fA-F\\d]{4}-4[a-fA-F\\d]{3}-[a-fA-F\\d]{4}-[a-fA-F\\d]{12}$",
            patternErrorMessage: "Not a proper IFID",
        },
        format: {
            description: "Twine 2 story format",
            type: "string",
        },
        "format-version": {
            description: "Twine 2 story format version",
            type: "string",
        },
        start: {
            description: "Name of the passage where the game will start",
            type: "string",
        },
        "tag-colors": {
            description:
                "How to color passages with a given tag in the Twine 2 editor",
            type: "object",
            patternProperties: {
                "^.*$": {
                    description: "Color",
                    type: "string",
                    pattern: "^(gray|red|orange|yellow|green|blue|purple)$",
                    patternErrorMessage:
                        "Must be one of gray, red, orange, yellow, green, blue, or purple",
                },
            },
            additionalProperties: false,
        },
        zoom: {
            description:
                "The zoom level of the story map in the Twine 2 editor (1.0 = 100%)",
            type: "number",
        },
    },
    required: ["ifid"],
    additionalProperties: false,
});
