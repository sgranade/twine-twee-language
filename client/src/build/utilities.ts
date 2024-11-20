/**
 * Mapping of entities to escaped strings.
 */
const entitiesEscape = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
};

/**
 * Regex to find HTML entities to be escaped.
 *
 * This is a minimal set to match Tweego's escape codes.
 */
const entitiesToEscapeRegex = /[&<>"']/g;

/**
 * Escape HTML characters.
 *
 * @param src Source string.
 * @returns Escaped string.
 */
export function escapeHtmlEntities(src: string): string {
    if (src.length > 0) {
        entitiesToEscapeRegex.lastIndex = 0;
        return src.replace(entitiesToEscapeRegex, (m) => entitiesEscape[m]);
    }
    return src;
}

/**
 * Regex to find attribute entities to be escaped.
 *
 * This is a minimal set to match Tweego's escape codes.
 */
const attrsToEscapeRegex = /[&"']/g;

/**
 * Escape entities in an HTML attribute.
 *
 * @param src Source string.
 * @returns Escaped string.
 */
export function escapeAttrEntities(src: string): string {
    if (src.length > 0) {
        attrsToEscapeRegex.lastIndex = 0;
        return src.replace(attrsToEscapeRegex, (m) => entitiesEscape[m]);
    }
    return src;
}
