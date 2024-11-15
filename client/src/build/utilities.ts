/**
 * Escape HTML characters.
 *
 * This is a minimal set to match Tweego's escape codes.
 *
 * @param src Source string.
 * @returns Escaped string.
 */
export function escapeHtmlEntities(src: string): string {
    if (src.length > 0) {
        return src
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    return src;
}

/**
 * Escape entities in an HTML attribute.
 *
 * This is a minimal set to match Tweego's escape codes.
 *
 * @param src Source string.
 * @returns Escaped string.
 */
export function escapeAttrEntities(src: string): string {
    if (src.length > 0) {
        return src
            .replace(/&/g, "&amp;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }
    return src;
}
