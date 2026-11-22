import { Diagnostic, Location } from "vscode-languageserver";

import { DiagnosticCodes } from "@tt3/shared";
import { referencesToDiagnostics } from "../diagnostics";
import { isBuiltinJSProperty } from "../js-parser";
import { ProjectIndex } from "../project-index";

/**
 * Get every location in the project that assigns to a story variable.
 *
 * @param index Project index.
 * @param assignmentKind Story format's symbol kind for an assignment.
 * @param name Story variable's name.
 * @returns Assignment locations, or undefined if there are none.
 */
export function getAssignmentLocations(
    index: ProjectIndex,
    assignmentKind: number,
    name: string,
): Location[] | undefined {
    const locations: Location[] = [];
    for (const uri of index.getIndexedUris()) {
        for (const ref of index.getReferences(uri, assignmentKind) ?? []) {
            if (ref.contents === name) locations.push(...ref.locations);
        }
    }
    return locations.length > 0 ? locations : undefined;
}

/**
 * Story format's settings for checking if a variable's never been set.
 */
export interface NeverSetCheck {
    /** Symbol kind for a story variable occurrence. */
    variableKind: number;
    /** Symbol kind for a story variable assignment. */
    variableSetKind: number;
    /** Symbol kind for a story property occurrence. */
    propertyKind: number;
    /** Symbol kind for a story property assignment. */
    propertySetKind: number;
    /** Variables the story format sets itself. */
    builtInVariables: Iterable<string>;
    /** Properties the story format sets itself. */
    builtInProperties: Iterable<string>;
    /** Diagnostic message for a variable or property that's never set. */
    message: string;
}

/**
 * Collect the names of every assignment of a symbol kind in the project.
 *
 * @param index Project index.
 * @param assignmentKind Story format's symbol kind for an assignment.
 * @param builtIns Names the story format sets itself.
 * @returns Set of assigned names.
 */
function getAssignedNames(
    index: ProjectIndex,
    assignmentKind: number,
    builtIns: Iterable<string>,
): Set<string> {
    const names = new Set(builtIns);
    for (const uri of index.getIndexedUris()) {
        for (const ref of index.getReferences(uri, assignmentKind) ?? []) {
            names.add(ref.contents);
        }
    }
    return names;
}

/**
 * Generate diagnostics for story variables and properties in a document that
 * aren't ever assigned to anywhere in the project.
 *
 * @param uri URI of the document to check.
 * @param index Project index.
 * @param check Story format's settings for the check.
 * @returns List of diagnostic messages.
 */
export function generateNeverAssignedToDiagnostics(
    uri: string,
    index: ProjectIndex,
    check: NeverSetCheck,
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    const varSetNames = getAssignedNames(
        index,
        check.variableSetKind,
        check.builtInVariables,
    );
    const propSetNames = getAssignedNames(
        index,
        check.propertySetKind,
        check.builtInProperties,
    );

    for (const varRef of index.getReferences(uri, check.variableKind) ?? []) {
        if (!varSetNames.has(varRef.contents)) {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    varRef,
                    DiagnosticCodes.VariableNeverSet,
                    check.message,
                ),
            );
        }
    }
    for (const propRef of index.getReferences(uri, check.propertyKind) ?? []) {
        if (
            !propSetNames.has(propRef.contents) &&
            !isBuiltinJSProperty(propRef)
        ) {
            diagnostics.push(
                ...referencesToDiagnostics(
                    index,
                    propRef,
                    DiagnosticCodes.VariableNeverSet,
                    check.message,
                ),
            );
        }
    }

    return diagnostics;
}
