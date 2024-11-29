import "mocha";
import { expect } from "chai";

import {
    Parameters,
    parseMacroParameters,
} from "../../../../passage-text-parsers/sugarcube/sc2/t3lt-parameters";

import * as uut from "../../../../passage-text-parsers/sugarcube/macros";
import { buildMacroInfo } from "./macro-builders";

describe("SugarCube Macros", () => {
    describe("argument parsing", () => {
        Object.values(uut.allMacros())
            .filter((macro) => Array.isArray(macro.arguments))
            .forEach((macro) => {
                it(`should successfully parse ${macro.name} arguments`, () => {
                    // Type checking for TypeScript's sake -- it can't reason about the above filter
                    if (!Array.isArray(macro.arguments)) return;

                    const result = parseMacroParameters(macro.arguments, {});

                    expect((result as Error).message).to.be.undefined;
                });
            });
    });

    describe("custom macros and enums", () => {
        describe("add/delete", () => {
            it("should make available custom macros from all documents in the all() function", () => {
                const firstMacro = buildMacroInfo({ name: "first" });
                const secondMacro = buildMacroInfo({
                    name: "second",
                    container: true,
                });

                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [firstMacro],
                    enums: {},
                });
                uut.setCustomMacrosAndEnums("uri-2", {
                    macros: [secondMacro],
                    enums: {},
                });
                const result = uut.allMacros();

                expect(result["first"]).to.eql(firstMacro);
                expect(result["second"]).to.eql(secondMacro);
            });

            it("should make available custom macro enums from all documents in the all() function", () => {
                // No arrange

                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [],
                    enums: { one: "un" },
                });
                uut.setCustomMacrosAndEnums("uri-2", {
                    macros: [],
                    enums: { two: "deux" },
                });
                const result = uut.allMacroEnums();

                expect(result["one"]).to.eql("un");
                expect(result["two"]).to.eql("deux");
            });

            it("should parse a custom macro's argument", () => {
                const macro = buildMacroInfo({ name: "first" });
                macro.arguments = ["text"];

                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [macro],
                    enums: {},
                });
                const result = uut.allMacros()["first"];

                expect(result.parsedArguments).is.instanceOf(Parameters);
            });

            it("should not parse a custom macro's malformed argument", () => {
                const macro = buildMacroInfo({ name: "first" });
                macro.arguments = ["this-is-not-a-thing"];

                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [macro],
                    enums: {},
                });
                const result = uut.allMacros()["first"];

                expect(result.parsedArguments).to.be.undefined;
            });

            it("should parse all custom macro arguments if enums change", () => {
                const firstMacro = buildMacroInfo({ name: "first" });
                firstMacro.arguments = undefined; // Start with no arguments
                const secondMacro = buildMacroInfo({
                    name: "second",
                    container: true,
                });
                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [firstMacro],
                    enums: {},
                });

                firstMacro.arguments = ["text"];
                uut.setCustomMacrosAndEnums("uri-2", {
                    macros: [secondMacro],
                    enums: { one: '"un"|"uno"' },
                });
                const result = uut.allMacros()["first"];

                expect(result.parsedArguments).is.instanceOf(Parameters);
            });

            it("should delete custom macros from a document when requested", () => {
                const firstMacro = buildMacroInfo({ name: "first" });
                const secondMacro = buildMacroInfo({
                    name: "second",
                    container: true,
                });

                uut.setCustomMacrosAndEnums("uri-1", {
                    macros: [firstMacro],
                    enums: {},
                });
                uut.setCustomMacrosAndEnums("uri-2", {
                    macros: [secondMacro],
                    enums: {},
                });
                uut.removeCustomMacroDocument("uri-1");
                const result = uut.allMacros();

                expect(result["first"]).to.be.undefined;
                expect(result["second"]).to.eql(secondMacro);
            });
        });

        describe("yaml conversion", () => {
            it("should return an error if there's no `sugarcube-2` header", () => {
                const yaml = `
nope:
  macros:
    ctp:
      name: ctp`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true);

                expect(result.macrosAndEnums).to.be.undefined;
                expect(result.errors.length).to.equal(1);
                expect(result.errors[0]).to.include(
                    "No `sugarcube-2` key found"
                );
            });

            it("should return an empty macro array if there are no macros", () => {
                const yaml = `
sugarcube-2:
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true);

                expect(result.macrosAndEnums?.macros).to.be.empty;
                expect(result.errors).to.be.empty;
            });

            it("should capture a macro's name even if it differs from the object name", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      name: othername
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "othername",
                    },
                ]);
            });

            it("should capture a macro's description", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      description: |-
        Oh hi there!
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        description: "Oh hi there!",
                    },
                ]);
            });

            it("should capture a macro's container value", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      container: true
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        container: true,
                    },
                ]);
            });

            it("should capture a macro's deprecation value", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      deprecated: true
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        deprecated: "0.1",
                    },
                ]);
            });

            it("should capture a macro's parameters", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      parameters:
        - text &+ ...text
        - passageNoSetter
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        arguments: ["text &+ ...text", "passageNoSetter"],
                    },
                ]);
            });

            it("should turn a macro's string-based child info to the child's parent info", () => {
                const yaml = `
sugarcube-2:
  macros:
    parentmacro:
      container: true
      children:
        - childmacro
    childmacro: {}
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "parentmacro",
                        container: true,
                    },
                    {
                        name: "childmacro",
                        parents: ["parentmacro"],
                    },
                ]);
            });

            it("should turn a macro's object-based child info to the child's parent info", () => {
                const yaml = `
sugarcube-2:
  macros:
    parentmacro:
      container: true
      children:
        - childmacro
        - name: otherchild
          max: 7
    childmacro: {}
    otherchild: {}
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "parentmacro",
                        container: true,
                    },
                    {
                        name: "childmacro",
                        parents: ["parentmacro"],
                    },
                    {
                        name: "otherchild",
                        parents: [{ name: "parentmacro", max: 7 }],
                    },
                ]);
            });

            it("should return an empty enum object if there are no enums", () => {
                const yaml = `
sugarcube-2:
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true);

                expect(result.macrosAndEnums?.enums).to.be.empty;
                expect(result.errors).to.be.empty;
            });

            it("should capture an enum name and value", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    second: '"two"|"deux"|"dos"'
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                    second: '"two"|"deux"|"dos"',
                });
            });

            it("should ignore illegal enum names", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    second%: '"two"|"deux"|"dos"'
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                });
            });

            it("should ignore non-string enum values", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    two: 17
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(yaml, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                });
            });

            it("should report illegal enum names", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    second%: '"two"|"deux"|"dos"'
    th'ird: '"two"|"deux"|"dos"'
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(
                    yaml,
                    true
                ).errors;

                expect(result[0]).to.include([
                    "names have illegal characters: second%, th'ird",
                ]);
            });

            it("should report non-string enum values", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    two: 17
    three:
      - arr
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(
                    yaml,
                    true
                ).errors;

                expect(result[0]).to.include([
                    "values aren't strings: two, three",
                ]);
            });

            it("should report all enum errors that are found", () => {
                const yaml = `
sugarcube-2:
  enums:
    first: '"one"|"un"|"uno"'
    second%: '"two"|"deux"|"dos"'
    three:
      - arr
`.trimStart();

                const result = uut.tweeConfigFileToMacrosAndEnums(
                    yaml,
                    true
                ).errors;

                expect(result[0]).to.include([
                    "names have illegal characters: second%",
                ]);
                expect(result[0]).to.include(["values aren't strings: three"]);
            });
        });

        describe("json conversion", () => {
            it("should return an error if there's no `sugarcube-2` header", () => {
                const json = `{
                    "nope": {
                      "macros": {
                        "ctp": {
                          "name": "ctp"
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, false);

                expect(result.macrosAndEnums).to.be.undefined;
                expect(result.errors.length).to.equal(1);
                expect(result.errors[0]).to.include(
                    "No `sugarcube-2` key found"
                );
            });

            it("should return an empty array if there are no macros", () => {
                const json = `{
                  "sugarcube-2": {
                  }
                }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result instanceof Error).to.be.false;
                expect(result).to.be.empty;
            });

            it("should capture a macro's name even if it differs from the object name", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "macroname": {
                          "name": "othername"
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "othername",
                    },
                ]);
            });

            it("should capture a macro's description", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "macroname": {
                          "description": "Oh hi there!"
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        description: "Oh hi there!",
                    },
                ]);
            });

            it("should capture a macro's container value", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "macroname": {
                          "container": true
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        container: true,
                    },
                ]);
            });

            it("should capture a macro's deprecation value", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "macroname": {
                          "deprecated": true
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        deprecated: "0.1",
                    },
                ]);
            });

            it("should capture a macro's parameters", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "macroname": {
                          "parameters": [
                            "text &+ ...text",
                            "passageNoSetter"
                          ]
                        }
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "macroname",
                        arguments: ["text &+ ...text", "passageNoSetter"],
                    },
                ]);
            });

            it("should turn a macro's string-based child info to the child's parent info", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "parentmacro": {
                          "container": true,
                          "children": [
                            "childmacro"
                          ]
                        },
                        "childmacro": {}
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "parentmacro",
                        container: true,
                    },
                    {
                        name: "childmacro",
                        parents: ["parentmacro"],
                    },
                ]);
            });

            it("should turn a macro's object-based child info to the child's parent info", () => {
                const json = `{
                    "sugarcube-2": {
                      "macros": {
                        "parentmacro": {
                          "container": true,
                          "children": [
                            "childmacro",
                            {
                              "name": "otherchild",
                              "max": 7
                            }
                          ]
                        },
                        "childmacro": {},
                        "otherchild": {}
                      }
                    }
                  }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.macros;

                expect(result).to.eql([
                    {
                        name: "parentmacro",
                        container: true,
                    },
                    {
                        name: "childmacro",
                        parents: ["parentmacro"],
                    },
                    {
                        name: "otherchild",
                        parents: [{ name: "parentmacro", max: 7 }],
                    },
                ]);
            });

            it("should return an empty enum object if there are no enums", () => {
                const json = `{
                  "sugarcube-2": {
                    "enums": {
                    }
                  }
                }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true);

                expect(result.macrosAndEnums?.enums).to.be.empty;
                expect(result.errors).to.be.empty;
            });

            it("should capture an enum name and value", () => {
                const json = `{
                  "sugarcube-2": {
                    "enums": {
                      "first": '"one"|"un"|"uno"',
                      "second": '"two"|"deux"|"dos"'
                    }
                  }
                }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                    second: '"two"|"deux"|"dos"',
                });
            });

            it("should ignore illegal enum names", () => {
                const json = `{
                  "sugarcube-2": {
                    "enums": {
                      "first": '"one"|"un"|"uno"',
                      "second%": '"two"|"deux"|"dos"'
                    }
                  }
                }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                });
            });

            it("should ignore non-string enum values", () => {
                const json = `{
                  "sugarcube-2": {
                    "enums": {
                      "first": '"one"|"un"|"uno"',
                      "second": 17
                    }
                  }
                }`;

                const result = uut.tweeConfigFileToMacrosAndEnums(json, true)
                    .macrosAndEnums?.enums;

                expect(result).to.eql({
                    first: '"one"|"un"|"uno"',
                });
            });
        });
    });
});
