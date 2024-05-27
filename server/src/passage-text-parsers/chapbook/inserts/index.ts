import { InsertParser } from "./types";

export * from "./types";

const builtins: InsertParser[] = [];

const inserts = [...builtins];

/**
 * Get all insert parsers.
 * @returns Insert parsers.
 */
export function all(): readonly InsertParser[] {
    return inserts;
}
