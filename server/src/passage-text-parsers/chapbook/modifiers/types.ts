/**
 * A parser for a specific modifier.
 */
export interface ModifierParser {
    /**
     * What to call this modifier.
     */
    name: string;
    /**
     * Regular expression that matches invocations of this modifier.
     */
    match: RegExp;
    /**
     * List of completions corresponding to this modifier.
     */
    completions: string[];
}
