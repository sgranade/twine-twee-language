/**
 * Entry in the de-jargoning table that matches message text exactly.
 */
interface ExactDejargonEntry {
    kind: "exact";
    pattern: string;
    replacement: string;
}

/**
 * Entry in the de-jargoning table that matches a regex pattern.
 * (These are mostly for messages w/a keyword or similar that need
 * to be reproduced.)
 */
interface RegexDejargonEntry {
    kind: "regex";
    pattern: RegExp;
    replacement: (match: RegExpExecArray) => string;
}

type DejargonEntry = ExactDejargonEntry | RegexDejargonEntry;

/**
 * Table to turn Acorn messages into (slightly) less JavaScript-jargon-y
 * mesages.
 *
 * Entries are tried in order until one successfully matches.
 */
const table: DejargonEntry[] = [
    {
        kind: "exact",
        pattern: "Assigning to rvalue",
        replacement: "Invalid assignment target",
    },
    {
        kind: "exact",
        pattern: "Binding rvalue",
        replacement: "Invalid destructuring target",
    },
    // This'll only show up if I turn on `preserveParens: true`.
    // TODO: consider if that's worth doing.
    {
        kind: "exact",
        pattern: "Binding parenthesized expression",
        replacement: "Parenthesized expression can't be a destructuring target",
    },
    {
        kind: "exact",
        pattern: "Binding member expression",
        replacement: "Member expression can't be a destructuring target",
    },
    // Arrow param list w/ouble-parenthesis name `((a), b) => a`
    {
        kind: "exact",
        pattern: "Parenthesized pattern",
        replacement: "Parenthesized expression can't be a destructuring target",
    },
    // `({a = 1})`.
    {
        kind: "exact",
        pattern:
            "Shorthand property assignments are valid only in destructuring patterns",
        replacement:
            "Shorthand property assignment is only valid in a destructuring pattern",
    },
    // Missing initializer `let {a} = {}, {b}`
    {
        kind: "exact",
        pattern: "Complex binding patterns require an initialization value",
        replacement: "Destructuring pattern needs an initial value",
    },
    // `let [a, ...b,] = []`.
    {
        kind: "exact",
        pattern: "Comma is not permitted after the rest element",
        replacement: "A rest element can't be followed by a comma",
    },
    // `([...a = []] = [])`.
    {
        kind: "exact",
        pattern: "Rest elements cannot have a default value",
        replacement: "A rest element can't have a default value",
    },
    // `let obj = {set a(...args) {}}`.
    {
        kind: "exact",
        pattern: "Setter cannot use rest params",
        replacement: "A setter can't use rest parameters",
    },
    // `break` or `continue` w/no enclosing loop, switch, or label
    {
        kind: "regex",
        pattern: /^Unsyntactic (break|continue)$/,
        replacement: (m) => `Invalid '${m[1]}': no enclosing loop or switch`,
    },
    // `a ?? b || c`.
    {
        kind: "exact",
        pattern:
            "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses",
        replacement:
            "Mixing '??' with '&&' or '||' needs parentheses around one of them",
    },
    // `({__proto__: 1, __proto__: 2})`.
    {
        kind: "exact",
        pattern: "Redefinition of __proto__ property",
        replacement: "Duplicate '__proto__' property",
    },
    // Getter as destructuring assignment `({get a() {}} = {})`
    {
        kind: "exact",
        pattern: "Object pattern can't contain getter or setter",
        replacement: "A destructuring pattern can't contain a getter or setter",
    },
    // `a?.b = 1`.
    {
        kind: "exact",
        pattern: "Optional chaining cannot appear in left-hand side",
        replacement: "'?.' can't appear on the left side of an assignment",
    },
    // `new a?.b()`.
    {
        kind: "exact",
        pattern:
            "Optional chaining cannot appear in the callee of new expressions",
        replacement: "'?.' can't appear before 'new'",
    },
    // `` a?.b`template` ``.
    {
        kind: "exact",
        pattern:
            "Optional chaining cannot appear in the tag of tagged template expressions",
        replacement: "'?.' can't appear before a tagged template",
    },
    // Escaped char inside keyword (like writing "if" as `\u0069f`)
    {
        kind: "regex",
        pattern: /^Escape sequence in keyword (.+)$/,
        replacement: (m) => `Invalid escape sequence in the keyword '${m[1]}'`,
    },
    // `function f() { 'use strict'; }` when `f`'s parameter
    // list isn't a plain list of simple names (default, rest, or
    // destructured parameters)
    {
        kind: "exact",
        pattern:
            "Illegal 'use strict' directive in function with non-simple parameter list",
        replacement:
            "'use strict' can't be used with default, rest, or destructured parameters",
    },
    // `function f(a, a) { 'use strict'; }`.
    {
        kind: "exact",
        pattern: "Argument name clash",
        replacement: "Duplicate parameter name",
    },
    // `1identifier`.
    {
        kind: "exact",
        pattern: "Identifier directly after number",
        replacement:
            "Missing space between a number and the following identifier",
    },
    // `new super()` inside a method that's not a subclass constructor
    {
        kind: "exact",
        pattern: "Invalid use of 'super'",
        replacement: "'new' can't be used with 'super'",
    },
];

/**
 * Rewrite an Acorn message using the dejargon table, or return it unchanged
 * if no entry matches.
 *
 * @param message Acorn's message, with any trailing "(line, column)"
 * location already stripped.
 */
export function dejargon(message: string): string {
    for (const entry of table) {
        if (entry.kind === "exact") {
            if (message === entry.pattern) {
                return entry.replacement;
            }
        } else {
            const m = entry.pattern.exec(message);
            if (m) {
                return entry.replacement(m);
            }
        }
    }

    return message;
}
