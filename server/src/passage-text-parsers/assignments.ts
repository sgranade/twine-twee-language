import { Diagnostic, Location } from "vscode-languageserver";

import { DiagnosticCodes } from "@tt3/shared";
import { referencesToDiagnostics } from "../diagnostics";
import { isBuiltinJSProperty } from "../js-parser";
import { ProjectIndex } from "../project-index";

/**
 * Get every location in the project that assigns to a story variable
 * or property.
 *
 * @param index Project index.
 * @param assignmentKind Story format's symbol kind for an assignment.
 * @param nameOrPath Story variable's name or property's full path.
 * @returns Assignment locations, or undefined if there are none.
 */
export function getAssignmentLocations(
    index: ProjectIndex,
    assignmentKind: number,
    nameOrPath: string,
): Location[] | undefined {
    const locations = index
        .getProjectReferences([assignmentKind])
        .filter((ref) => ref.contents === nameOrPath)
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
    /** Built-in variables whose properties are indexed (e.g. SugarCube's `setup`). */
    indexedBuiltInVariables?: Iterable<string>;
    /** Diagnostic message for a variable or property that's never set. */
    message: string;
}

/**
 * Decides whether a story property counts as set, following shape sources.
 */
class PropertySetResolver {
    constructor(
        private readonly propSetNames: Set<string>,
        private readonly opaquePaths: Set<string>,
        private readonly shapeSources: Map<string, Set<string>>,
        private readonly builtInVariables: Set<string>,
    ) {}

    /**
     * Does a property count as set?
     *
     * @param property Property's full dotted path.
     * @param following Ancestor paths whose shape sources are being followed.
     * @returns True if the property counts as set.
     */
    isSet(property: string, following = new Set<string>()): boolean {
        /*
         * A property counts as set if it's written directly, lies beneath an opaque
         * path, or counts as set at the same place beneath one of an ancestor path's
         * shape sources (`_p.a.b` as `$player.a.b` for `_p = $player`). A shape
         * source that leads back to a path already being followed is a cycle, and one
         * rooted in a story format's built-in variable is of unknown shape (unless the
         * caller left that variable out, because its properties are indexed).
         */

        if (this.propSetNames.has(property)) return true;
        for (
            let end = property.lastIndexOf(".");
            end > 0;
            end = property.lastIndexOf(".", end - 1)
        ) {
            const ancestor = property.slice(0, end);
            if (this.opaquePaths.has(ancestor)) return true;
            const sources = this.shapeSources.get(ancestor);
            if (sources === undefined) continue;
            if (following.has(ancestor)) return true;
            following.add(ancestor);
            const rest = property.slice(end);
            for (const source of sources) {
                if (
                    // The story format sets its own variables' properties
                    // where we can't see them
                    this.builtInVariables.has(source.split(".", 1)[0]) ||
                    this.isSet(source + rest, following)
                ) {
                    following.delete(ancestor);
                    return true;
                }
            }
            following.delete(ancestor);
        }
        return false;
    }
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
    const opaquePaths = new Set<string>();
    const shapeSources = new Map<string, Set<string>>();
    for (const ref of [...varSets, ...propSets]) {
        if (ref.opaque) opaquePaths.add(ref.contents);
        for (const source of ref.shapeSources ?? []) {
            const sources = shapeSources.get(ref.contents) ?? new Set();
            sources.add(source);
            shapeSources.set(ref.contents, sources);
        }
    }
    const indexed = new Set(check.indexedBuiltInVariables);
    const resolver = new PropertySetResolver(
        propSetNames,
        opaquePaths,
        shapeSources,
        new Set([...check.builtInVariables].filter((v) => !indexed.has(v))),
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
        // Don't report built-in JS properties, those that hang off of an opaque item,
        // or those that match shape sources
        if (
            !isBuiltinJSProperty(propRef) &&
            !resolver.isSet(propRef.contents)
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
