import { Hover, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { doHover } from "./embedded-languages";
import { ProjectIndex } from "./index";
import { containingRange, normalizeUri } from "./utilities";

export async function generateHover(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Promise<Hover | null | undefined> {
    const documentUri = normalizeUri(document.uri);
    const offset = document.offsetAt(position);
    let hover: Hover | null | undefined;

    // Embedded documents get to create their own completions
    for (const embeddedDocument of index.getEmbeddedDocuments(documentUri) ||
        []) {
        if (
            offset >= embeddedDocument.offset &&
            offset <
                embeddedDocument.offset +
                    embeddedDocument.document.getText().length
        ) {
            hover = await doHover(embeddedDocument, offset);

            // Adjust ranges to be in the parent document and not the sub-document
            if (Hover.is(hover) && hover.range !== undefined) {
                hover.range = containingRange(
                    embeddedDocument.document,
                    hover.range,
                    document,
                    embeddedDocument.offset
                );
            }
        }
    }

    return hover;
}
