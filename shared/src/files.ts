/**
 * Extensions of Twee source files.
 */
export const tweeFileExtensions: readonly string[] = [".tw", ".twee"];

/**
 * Extensions of script files.
 */
export const scriptFileExtensions: readonly string[] = [".js"];

/**
 * Does a path or URI end in one of the given extensions?
 *
 * This does a case-insensitive match, fyi.
 *
 * @param path Path or URI string to test.
 * @param extensions Extensions, including the leading dot.
 */
export function hasFileExtension(
    path: string,
    extensions: readonly string[],
): boolean {
    const lower = path.toLowerCase();
    return extensions.some((ext) => lower.endsWith(ext));
}

/**
 * Is a file a Twee file?
 *
 * @param path Path or URI string to test.
 */
export function isTweeFile(path: string): boolean {
    return hasFileExtension(path, tweeFileExtensions);
}

/**
 * Is a file a script file?
 *
 * @param path Path or URI string to test.
 */
export function isScriptFile(path: string): boolean {
    return hasFileExtension(path, scriptFileExtensions);
}
