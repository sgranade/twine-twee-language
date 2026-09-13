import { expect } from "chai";
import "mocha";

import { ParserWithState } from "../../acorn-errors/parser-state";

import * as uut from "../../acorn-errors";

/**
 * One row of the baseline corpus.
 */
interface TestCase {
    description: string;
    input: string;
    expectedMessage: string;
    expectedStart: number;
    expectedEnd: number;
}

/**
 * Parse `input` the same way `parseJS` does and return the resulting
 * SyntaxError, or throw if the input actually parses.
 */
function parseAndCaptureError(input: string): uut.AcornSyntaxError {
    ParserWithState.parse(input, { ecmaVersion: 2020, sourceType: "script" });
    throw new Error(`expected "${input}" to fail to parse, but it parsed`);
}

const testCases: TestCase[] = [
    // --- Systematic sweep of Acorn's three generic messages ---
    {
        description: "generic sweep: bare identifiers",
        input: "a b c",
        expectedMessage: "Unexpected token 'b'",
        expectedStart: 2,
        expectedEnd: 3,
    },
    {
        description: "generic sweep: empty object property value",
        input: "{a: }",
        expectedMessage: "Missing value after ':'",
        expectedStart: 2,
        expectedEnd: 3,
    },
    {
        description: "generic sweep: unclosed call parens",
        input: "foo(",
        expectedMessage: "Opening '(' is missing a matching ')'",
        expectedStart: 3,
        expectedEnd: 4,
    },
    {
        description: "generic sweep: unclosed array",
        input: "[1,2",
        expectedMessage: "Opening '[' is missing a matching ']'",
        expectedStart: 0,
        expectedEnd: 1,
    },
    {
        description: "generic sweep: bare catch keyword",
        input: "catch ",
        expectedMessage: "Unexpected token 'catch'",
        expectedStart: 0,
        expectedEnd: 5,
    },
    {
        description: "generic sweep: try with no catch or finally",
        input: "try{}",
        expectedMessage: "Missing catch or finally clause",
        expectedStart: 0,
        expectedEnd: 3,
    },
    {
        description: "generic sweep: unclosed if body",
        input: "if(a){",
        expectedMessage: "Opening '{' is missing a matching '}'",
        expectedStart: 5,
        expectedEnd: 6,
    },
    {
        description: "generic sweep: invalid character",
        input: "x = 1 @ y",
        expectedMessage: "Unexpected character '@'",
        expectedStart: 6,
        expectedEnd: 7,
    },
    {
        description:
            "generic sweep: numeric literal followed by identifier " +
            "(updated in phase 02: dejargon rewrites this message)",
        input: "1_",
        expectedMessage:
            "Missing space between a number and the following identifier",
        expectedStart: 1,
        expectedEnd: 2,
    },

    // --- Broken JavaScript harvested from existing story-format test fixtures ---
    {
        description:
            "harvested from chapbook-parser.test.ts's [javascript] engine.extend " +
            "fixture, truncated by dropping the trailing ');' as if an author saved " +
            "mid-edit",
        input: "engine.extend('2.0.1', () => {\nengine.template.inserts.add(\n{match: /hi/}\n);\n}",
        expectedMessage: "Opening '(' is missing a matching ')'",
        expectedStart: 13,
        expectedEnd: 14,
    },
    {
        description:
            "harvested from sugarcube-parser.test.ts's macro-argument fixture " +
            '"<<a \'unterminated>>" -- the JS fragment SugarCube hands to the parser',
        input: "'unterminated",
        expectedMessage: "Unterminated string constant",
        expectedStart: 0,
        expectedEnd: 13,
    },

    // --- One hand-written typo per existing rule ---
    {
        description: "rule: unterminated string constant",
        input: "let x = 'unterminated",
        expectedMessage: "Unterminated string constant",
        expectedStart: 8,
        expectedEnd: 21,
    },
    {
        description: "rule: unterminated template literal",
        input: "let x = `unterminated",
        expectedMessage: "Unterminated template",
        expectedStart: 9,
        expectedEnd: 21,
    },
    {
        description: "rule: unmatched opening paren",
        input: "let x = (1 + 2",
        expectedMessage: "Opening '(' is missing a matching ')'",
        expectedStart: 8,
        expectedEnd: 9,
    },
    {
        description: "rule: unmatched opening bracket",
        input: "let arr = [1, 2",
        expectedMessage: "Opening '[' is missing a matching ']'",
        expectedStart: 10,
        expectedEnd: 11,
    },
    {
        description: "rule: unmatched opening brace",
        input: "let obj = {a: 1",
        expectedMessage: "Opening '{' is missing a matching '}'",
        expectedStart: 10,
        expectedEnd: 11,
    },
    {
        description: "rule: missing property name after dot",
        input: "foo.",
        expectedMessage: "Missing property or method name after '.'",
        expectedStart: 3,
        expectedEnd: 4,
    },
    {
        description: "rule: optional chaining operator",
        input: "foo?.",
        expectedMessage: "Missing property, method, or call after '?.'",
        expectedStart: 3,
        expectedEnd: 5,
    },
    {
        description: "rule: incomplete expression after operator",
        input: "foo +",
        expectedMessage: "Incomplete expression after the operator '+'",
        expectedStart: 4,
        expectedEnd: 5,
    },
    {
        description: "rule: incomplete property definition",
        input: "let obj = {foo: }",
        expectedMessage: "Missing value after ':'",
        expectedStart: 14,
        expectedEnd: 15,
    },
    {
        description: "rule: incomplete if statement",
        input: "let x = 1; if ",
        expectedMessage: "Missing '(' after 'if'",
        expectedStart: 11,
        expectedEnd: 13,
    },
    {
        description: "rule: incomplete while statement",
        input: "while ",
        expectedMessage: "Missing '(' after 'while'",
        expectedStart: 0,
        expectedEnd: 5,
    },
    {
        description: "rule: incomplete catch statement",
        input: "let x = 1; try {} catch ",
        expectedMessage: "Missing '{' after 'catch'",
        expectedStart: 18,
        expectedEnd: 23,
    },
    {
        description: "rule: catch clause with a binding but no block",
        input: "let x = 1; try {} catch (e)",
        expectedMessage: "Missing '{' after 'catch'",
        expectedStart: 18,
        expectedEnd: 23,
    },

    // --- Dejargon table: plain-language rewrites of Acorn's ---
    // --- jargon-heavy messages, which never reach the rules above ---
    {
        description: "dejargon: assigning to a non-assignable expression",
        input: "1 = 2",
        expectedMessage: "Invalid assignment target",
        expectedStart: 0,
        expectedEnd: 1,
    },
    {
        description: "dejargon: doubly-parenthesized arrow function parameter",
        input: "((a), b) => a",
        expectedMessage:
            "Parenthesized expression can't be a destructuring target",
        expectedStart: 1,
        expectedEnd: 2,
    },
    {
        description:
            "dejargon: shorthand property assignment outside a pattern",
        input: "({a = 1})",
        expectedMessage:
            "Shorthand property assignment is only valid in a destructuring pattern",
        expectedStart: 4,
        expectedEnd: 5,
    },
    {
        description: "dejargon: destructuring pattern with no initializer",
        input: "let {a} = {}, {b}",
        expectedMessage: "Destructuring pattern needs an initial value",
        expectedStart: 16,
        expectedEnd: 17,
    },
    {
        description: "dejargon: comma after a rest element",
        input: "let [a, ...b,] = []",
        expectedMessage: "A rest element can't be followed by a comma",
        expectedStart: 12,
        expectedEnd: 13,
    },
    {
        description: "dejargon: rest element with a default value",
        input: "([...a = []] = [])",
        expectedMessage: "A rest element can't have a default value",
        expectedStart: 5,
        expectedEnd: 6,
    },
    {
        description: "dejargon: setter using rest parameters",
        input: "let obj = {set a(...args) {}}",
        expectedMessage: "A setter can't use rest parameters",
        expectedStart: 17,
        expectedEnd: 20,
    },
    {
        description: "dejargon: break with no enclosing loop or switch",
        input: "break",
        expectedMessage: "Invalid 'break': no enclosing loop or switch",
        expectedStart: 0,
        expectedEnd: 5,
    },
    {
        description: "dejargon: continue with no enclosing loop",
        input: "continue",
        expectedMessage: "Invalid 'continue': no enclosing loop or switch",
        expectedStart: 0,
        expectedEnd: 8,
    },
    {
        description: "dejargon: mixing '??' with '||' without parentheses",
        input: "a ?? b || c",
        expectedMessage:
            "Mixing '??' with '&&' or '||' needs parentheses around one of them",
        expectedStart: 7,
        expectedEnd: 9,
    },
    {
        description: "dejargon: duplicate '__proto__' property",
        input: "({__proto__: 1, __proto__: 2})",
        expectedMessage: "Duplicate '__proto__' property",
        expectedStart: 16,
        expectedEnd: 25,
    },
    {
        description:
            "dejargon: getter used as a destructuring assignment target",
        input: "({get a() {}} = {})",
        expectedMessage:
            "A destructuring pattern can't contain a getter or setter",
        expectedStart: 6,
        expectedEnd: 7,
    },
    {
        description: "dejargon: optional chaining on an assignment's left side",
        input: "a?.b = 1",
        expectedMessage: "'?.' can't appear on the left side of an assignment",
        expectedStart: 0,
        expectedEnd: 1,
    },
    {
        description: "dejargon: optional chaining before 'new'",
        input: "new a?.b()",
        expectedMessage: "'?.' can't appear before 'new'",
        expectedStart: 5,
        expectedEnd: 7,
    },
    {
        description: "dejargon: optional chaining before a tagged template",
        input: "a?.b`template`",
        expectedMessage: "'?.' can't appear before a tagged template",
        expectedStart: 4,
        expectedEnd: 5,
    },
    {
        description: "dejargon: escaped character inside a keyword",
        input: "function f() { 'use strict'; \\u0069f (1) {} }",
        expectedMessage: "Invalid escape sequence in the keyword 'if'",
        expectedStart: 29,
        expectedEnd: 36,
    },
    {
        description: "dejargon: duplicate parameter name",
        input: "function f(a, a) { 'use strict'; }",
        expectedMessage: "Duplicate parameter name",
        expectedStart: 14,
        expectedEnd: 15,
    },
    {
        description: "dejargon: 'use strict' with a non-simple parameter list",
        input: "function f({a}) { 'use strict'; }",
        expectedMessage:
            "'use strict' can't be used with default, rest, or destructured parameters",
        expectedStart: 0,
        expectedEnd: 8,
    },
    {
        description: "dejargon: 'new super()' outside a subclass constructor",
        input: "class C extends D { constructor() { new super(); } }",
        expectedMessage: "'new' can't be used with 'super'",
        expectedStart: 40,
        expectedEnd: 45,
    },

    // --- Rule arbitration ---
    {
        description: "the unclosed '(' is reported at the paren itself",
        input: "x = 'hello' + (1",
        expectedMessage: "Opening '(' is missing a matching ')'",
        expectedStart: 14,
        expectedEnd: 15,
    },
    {
        description: "the unclosed '[' is reported at the bracket itself",
        input: 'x = "foo" + [1',
        expectedMessage: "Opening '[' is missing a matching ']'",
        expectedStart: 12,
        expectedEnd: 13,
    },
    {
        description: "the missing property value beats the open '('",
        input: "let x = (1, {a: }",
        expectedMessage: "Missing value after ':'",
        expectedStart: 14,
        expectedEnd: 15,
    },
    {
        description:
            "at end of input the unclosed delimiter wins even though the " +
            "missing property after '.' is nearer to the failure position",
        input: "foo(bar.",
        expectedMessage: "Opening '(' is missing a matching ')'",
        expectedStart: 3,
        expectedEnd: 4,
    },
    {
        description: "a mismatched close is reported",
        input: "let x = (]",
        expectedMessage: "Opening '(' is closed by ']' instead of ')'",
        expectedStart: 9,
        expectedEnd: 10,
    },
    {
        description:
            "the unclosed '{' is all there is to report here b/c the failure's " +
            "two tokens past the dangling 'c:'",
        input: "let a = { b: 1, c:  \nlet d = 2;",
        expectedMessage: "Opening '{' is missing a matching '}'",
        expectedStart: 8,
        expectedEnd: 9,
    },
    {
        description:
            "coverage gap: the dangling '+' is two tokens back, so the " +
            "incomplete-expression rule, which looks at the token immediately " +
            "before the failure, doesn't see it",
        input: "let a = 1 +\nlet b = 2;",
        expectedMessage: "Unexpected token 'b'",
        expectedStart: 16,
        expectedEnd: 17,
    },

    // --- Fallback span: what gets underlined when no rule matched ---
    {
        description:
            "fallback: the last non-whitespace character at end of input " +
            "with nothing left open",
        input: "if (a) ;\nelse",
        expectedMessage: "Unexpected end of input",
        expectedStart: 12,
        expectedEnd: 13,
    },
    {
        description: "fallback: the whole failing token",
        input: "let x = 1; x oops",
        expectedMessage: "Unexpected token 'oops'",
        expectedStart: 13,
        expectedEnd: 17,
    },
    {
        description:
            "fallback: a message the rules never see still gets the failing " +
            "token's span",
        input: "let x = 1;\nreturn",
        expectedMessage: "'return' outside of function",
        expectedStart: 11,
        expectedEnd: 17,
    },
];

describe("Acorn Error Messages", () => {
    for (const {
        description,
        input,
        expectedMessage,
        expectedStart,
        expectedEnd,
    } of testCases) {
        it(`should report: ${description}`, () => {
            const err = (() => {
                try {
                    return parseAndCaptureError(input);
                } catch (e) {
                    if (e instanceof SyntaxError) return e;
                    throw e;
                }
            })();

            const result = uut.improveAcornErrorMessage(input, err);

            expect(result.message).to.equal(expectedMessage);
            expect(result.start).to.equal(expectedStart);
            expect(result.end).to.equal(expectedEnd);
        });
    }
});
