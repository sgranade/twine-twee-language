import { expect } from "chai";
import "mocha";

import * as uut from "../acorn-errors/dejargon";

describe("dejargon", () => {
    it("should leave a message with no matching entry unchanged", () => {
        const message = "Some message Acorn never actually sends";

        const result = uut.dejargon(message);

        expect(result).to.equal("Some message Acorn never actually sends");
    });

    it("should rewrite 'Assigning to rvalue'", () => {
        const message = "Assigning to rvalue";

        const result = uut.dejargon(message);

        expect(result).to.equal("Invalid assignment target");
    });

    it("should rewrite 'Binding rvalue'", () => {
        const message = "Binding rvalue";

        const result = uut.dejargon(message);

        expect(result).to.equal("Invalid destructuring target");
    });

    it("should rewrite 'Binding parenthesized expression'", () => {
        const message = "Binding parenthesized expression";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Parenthesized expression can't be a destructuring target",
        );
    });

    it("should rewrite 'Binding member expression'", () => {
        const message = "Binding member expression";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Member expression can't be a destructuring target",
        );
    });

    it("should rewrite 'Parenthesized pattern'", () => {
        const message = "Parenthesized pattern";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Parenthesized expression can't be a destructuring target",
        );
    });

    it("should rewrite the shorthand property assignment message", () => {
        const message =
            "Shorthand property assignments are valid only in destructuring patterns";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Shorthand property assignment is only valid in a destructuring pattern",
        );
    });

    it("should rewrite the complex binding pattern message", () => {
        const message =
            "Complex binding patterns require an initialization value";

        const result = uut.dejargon(message);

        expect(result).to.equal("Destructuring pattern needs an initial value");
    });

    it("should rewrite the rest-element-comma message", () => {
        const message = "Comma is not permitted after the rest element";

        const result = uut.dejargon(message);

        expect(result).to.equal("A rest element can't be followed by a comma");
    });

    it("should rewrite the rest-element-default-value message", () => {
        const message = "Rest elements cannot have a default value";

        const result = uut.dejargon(message);

        expect(result).to.equal("A rest element can't have a default value");
    });

    it("should rewrite the setter-rest-params message", () => {
        const message = "Setter cannot use rest params";

        const result = uut.dejargon(message);

        expect(result).to.equal("A setter can't use rest parameters");
    });

    it("should rewrite 'Unsyntactic break', keeping the keyword", () => {
        const message = "Unsyntactic break";

        const result = uut.dejargon(message);

        expect(result).to.equal("Invalid 'break': no enclosing loop or switch");
    });

    it("should rewrite 'Unsyntactic continue', keeping the keyword", () => {
        const message = "Unsyntactic continue";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Invalid 'continue': no enclosing loop or switch",
        );
    });

    it("should rewrite the mixed logical/coalesce message", () => {
        const message =
            "Logical expressions and coalesce expressions cannot be mixed. Wrap either by parentheses";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Mixing '??' with '&&' or '||' needs parentheses around one of them",
        );
    });

    it("should rewrite the '__proto__' redefinition message", () => {
        const message = "Redefinition of __proto__ property";

        const result = uut.dejargon(message);

        expect(result).to.equal("Duplicate '__proto__' property");
    });

    it("should rewrite the object-pattern-getter-or-setter message", () => {
        const message = "Object pattern can't contain getter or setter";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "A destructuring pattern can't contain a getter or setter",
        );
    });

    it("should rewrite the optional-chaining-in-left-hand-side message", () => {
        const message = "Optional chaining cannot appear in left-hand side";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "'?.' can't appear on the left side of an assignment",
        );
    });

    it("should rewrite the optional-chaining-before-new message", () => {
        const message =
            "Optional chaining cannot appear in the callee of new expressions";

        const result = uut.dejargon(message);

        expect(result).to.equal("'?.' can't appear before 'new'");
    });

    it("should rewrite the optional-chaining-before-tagged-template message", () => {
        const message =
            "Optional chaining cannot appear in the tag of tagged template expressions";

        const result = uut.dejargon(message);

        expect(result).to.equal("'?.' can't appear before a tagged template");
    });

    it("should rewrite the escape-sequence-in-keyword message, keeping the keyword", () => {
        const message = "Escape sequence in keyword if";

        const result = uut.dejargon(message);

        expect(result).to.equal("Invalid escape sequence in the keyword 'if'");
    });

    it("should rewrite the non-simple-parameter-list 'use strict' message", () => {
        const message =
            "Illegal 'use strict' directive in function with non-simple parameter list";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "'use strict' can't be used with default, rest, or destructured parameters",
        );
    });

    it("should rewrite the argument-name-clash message", () => {
        const message = "Argument name clash";

        const result = uut.dejargon(message);

        expect(result).to.equal("Duplicate parameter name");
    });

    it("should rewrite the identifier-after-number message", () => {
        const message = "Identifier directly after number";

        const result = uut.dejargon(message);

        expect(result).to.equal(
            "Missing space between a number and the following identifier",
        );
    });

    it("should rewrite the invalid-use-of-super message", () => {
        const message = "Invalid use of 'super'";

        const result = uut.dejargon(message);

        expect(result).to.equal("'new' can't be used with 'super'");
    });
});
