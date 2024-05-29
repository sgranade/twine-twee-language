import { after } from "./after";
import { align } from "./align";
import { append } from "./append";
import { conditionals } from "./conditionals";
import { cont } from "./continue";
import { css } from "./css";
import { javascript } from "./javascript";
import { note } from "./note";
import { ModifierParser } from "./types";

export * from "./types";

const builtins: ModifierParser[] = [
    after,
    align,
    append,
    conditionals,
    cont,
    css,
    javascript,
    note,
];

const inserts = [...builtins];

/**
 * Get all modifier parsers.
 * @returns Modifier parsers.
 */
export function all(): readonly ModifierParser[] {
    return inserts;
}