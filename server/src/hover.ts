import { Hover, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { doHover } from "./embedded-languages";
import { ProjectIndex } from "./project-index";
import { containingRange, positionInRange } from "./utilities";
import { getStoryFormatParser } from "./passage-text-parsers";

export async function generateHover(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Promise<Hover | null | undefined> {
    const offset = document.offsetAt(position);

    // Embedded documents get to create their own completions
    for (const embeddedDocument of index.getEmbeddedDocuments(document.uri) ||
        []) {
        if (positionInRange(position, embeddedDocument.range)) {
            const hover = await doHover(document, embeddedDocument, offset);

            // Adjust ranges to be in the parent document and not the sub-document
            if (Hover.is(hover) && hover.range !== undefined) {
                hover.range = containingRange(
                    embeddedDocument.document,
                    hover.range,
                    document,
                    document.offsetAt(embeddedDocument.range.start)
                );
            }

            return hover;
        }
    }

    // If there's a story format, let its parser provide optional hover information
    const storyFormat = index.getStoryData()?.storyFormat;
    if (storyFormat !== undefined) {
        const parser = getStoryFormatParser(storyFormat);
        if (parser !== undefined) {
            return parser.generateHover(document, position, index);
        }
    }

    return undefined;
}
