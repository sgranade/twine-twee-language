import { Hover, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { OChapbookSymbolKind } from "./chapbook-parser";
import { all as allInserts } from "./inserts";
import { all as allModifiers } from "./modifiers";

export function generateHover(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Hover | null {
    // See if we have any references to a built-in insert or modifier. If so,
    // return its description as the hover information.
    const refs = index.getReferencesAt(document.uri, position);
    if (refs !== undefined) {
        if (refs.kind === OChapbookSymbolKind.BuiltInInsert) {
            const insert = allInserts().find((i) =>
                i.match.test(refs.contents)
            );
            if (insert !== undefined) {
                return { contents: insert.description };
            }
        } else if (refs.kind === OChapbookSymbolKind.BuiltInModifier) {
            const modifier = allModifiers().find((i) =>
                i.match.test(refs.contents)
            );
            if (modifier !== undefined) {
                return { contents: modifier.description };
            }
        }
    }

    return null;
}
