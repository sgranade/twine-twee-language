import { Definition, Position } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { ProjectIndex } from "../../project-index";
import { getChapbookDefinitions } from "./chapbook-parser";

export function getDefinitionAt(
    document: TextDocument,
    position: Position,
    index: ProjectIndex
): Definition | undefined {
    // The index will find all regular definitions and references.
    // It won't work for custom inserts and modifiers, however, as they're
    // matched through a regex test.

    const ref = index.getReferencesAt(document.uri, position);
    if (ref !== undefined) {
        const definition = getChapbookDefinitions(ref.kind, index).find((def) =>
            def.match.test(ref.contents)
        );
        if (definition !== undefined) {
            return definition.location;
        }
    }

    return undefined;
}
