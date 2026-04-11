import { Hover, MarkupKind, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { EmbeddedDocument } from "../../embedded-languages";
import { ProjectIndex } from "../../project-index";
import { getChapbookDefinitions } from "./chapbook-parser";
import { ChapbookFunctionInfo, OChapbookSymbolKind } from "./types";
import { all as allInserts } from "./inserts";
import { all as allModifiers } from "./modifiers";

function generateDescription(
    item: ChapbookFunctionInfo | undefined
): Hover | null {
    if (item !== undefined && item.description !== undefined) {
        let value = item.description;
        if (item.syntax !== undefined) {
            value = "```chapbook\n" + item.syntax + "\n```\n\n" + value;
        }
        return {
            contents: {
                kind: MarkupKind.Markdown,
                value: value,
            },
        };
    }

    return null;
}

export function generateHover(
    document: TextDocument,
    position: Position,
    deferredEmbeddedDocuments: EmbeddedDocument[],
    index: ProjectIndex
): Hover | null {
    // See if we have any references to an insert or modifier. If so,
    // return its description (if it exists) as the hover information.
    const refs = index.getReferencesAt(document.uri, position);
    if (refs !== undefined) {
        let matchedObjects: readonly ChapbookFunctionInfo[] = [];
        if (refs.kind === OChapbookSymbolKind.BuiltInInsert) {
            matchedObjects = allInserts();
        } else if (refs.kind === OChapbookSymbolKind.BuiltInModifier) {
            matchedObjects = allModifiers();
        } else if (
            refs.kind === OChapbookSymbolKind.CustomInsert ||
            refs.kind === OChapbookSymbolKind.CustomModifier
        ) {
            matchedObjects = getChapbookDefinitions(refs.kind, index);
        }

        return generateDescription(
            matchedObjects.find((o) => o.match.test(refs.contents))
        );
    }

    return null;
}
