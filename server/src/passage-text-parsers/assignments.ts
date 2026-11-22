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
    const locations = index
        .getProjectReferences([assignmentKind])
        .filter((ref) => ref.contents === name)
        .flatMap((ref) => ref.locations);
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
 * Is a property beneath (but not at) any opaque path?
 *
 * @param property Property's full dotted path.
 * @param opaquePaths Opaque paths.
 * @returns True if the property is beneath an opaque path.
 */
function isBeneathOpaquePath(
    property: string,
    opaquePaths: Set<string>,
): boolean {
    for (
        let end = property.lastIndexOf(".");
        end > 0;
        end = property.lastIndexOf(".", end - 1)
    ) {
        if (opaquePaths.has(property.slice(0, end))) return true;
    }
    return false;
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

    const varSets = index.getProjectReferences([check.variableSetKind]);
    const propSets = index.getProjectReferences([check.propertySetKind]);
    const varSetNames = new Set([
        ...check.builtInVariables,
        ...varSets.map((ref) => ref.contents),
    ]);
    const propSetNames = new Set([
        ...check.builtInProperties,
        ...propSets.map((ref) => ref.contents),
    ]);
    const opaquePaths = new Set(
        [...varSets, ...propSets]
            .filter((ref) => ref.opaque)
            .map((ref) => ref.contents),
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
        // Don't report built-in JS properties or those that hang off of an opaque item
        if (
            !propSetNames.has(propRef.contents) &&
            !isBuiltinJSProperty(propRef) &&
            !isBeneathOpaquePath(propRef.contents, opaquePaths)
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
