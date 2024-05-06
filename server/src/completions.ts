import { CompletionList, Position, Range } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "./index";
import { normalizeUri } from "./utilities";
import { jsonLanguageService } from "./parser";

export async function generateCompletions(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Promise<CompletionList | null> {
    const documentUri = normalizeUri(document.uri);
    const offset = document.offsetAt(position);

    // Embedded documents get to create their own completions
    const embeddedDocuments = index.getEmbeddedJSONDocuments(documentUri) || [];
    for (const embeddedDocument of embeddedDocuments) {
        const embeddedDocumentOffset = document.offsetAt(
            embeddedDocument.position
        );
        if (
            offset >= embeddedDocumentOffset &&
            offset <
                embeddedDocumentOffset +
                    embeddedDocument.document.getText().length
        ) {
            const completions = await jsonLanguageService.doComplete(
                embeddedDocument.document,
                embeddedDocument.document.positionAt(
                    offset - embeddedDocumentOffset
                ),
                embeddedDocument.jsonDocument
            );
            // The completions's positions are relative to the sub-document, so we need
            // to adjust those to be relative to the parent document
            if (completions !== null) {
                for (const item of completions.items) {
                    if (
                        item.textEdit !== undefined &&
                        "range" in item.textEdit
                    ) {
                        item.textEdit.range = Range.create(
                            document.positionAt(
                                embeddedDocument.document.offsetAt(
                                    item.textEdit.range.start
                                ) + embeddedDocumentOffset
                            ),
                            document.positionAt(
                                embeddedDocument.document.offsetAt(
                                    item.textEdit.range.end
                                ) + embeddedDocumentOffset
                            )
                        );
                    }
                }
            }
            return completions;
        }
    }

    return null;
}
