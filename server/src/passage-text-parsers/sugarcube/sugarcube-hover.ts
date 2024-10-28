import { Hover, MarkupKind, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { allMacros, allMacroEnums } from "./macros";
import { OSugarCubeSymbolKind } from "./types";
import { parseEnums } from "./sc2/t3lt-parameters";

export function generateHover(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Hover | null {
    // See if we have any references to a macro. If so, return its
    // description (if it exists) as the hover information.
    const refs = index.getReferencesAt(document.uri, position);
    if (refs !== undefined && refs.kind === OSugarCubeSymbolKind.KnownMacro) {
        const macro = allMacros()[refs.contents];
        if (macro?.description !== undefined) {
            // Note that `parseEnums()` is parsing custom macro enums
            let value = parseEnums(macro.description, allMacroEnums());
            if (macro.syntax !== undefined) {
                value = "```sugarcube\n" + macro.syntax + "\n```\n\n" + value;
            }
            return {
                contents: {
                    kind: MarkupKind.Markdown,
                    value: value,
                },
            };
        }
    }

    return null;
}
