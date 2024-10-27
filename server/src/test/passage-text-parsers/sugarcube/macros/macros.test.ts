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
        Object.values(uut.all())
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

    describe("custom macros", () => {
        describe("add/delete", () => {
            it("should make available custom macros from all documents in the all() function", () => {
                const firstMacro = buildMacroInfo({ name: "first" });
                const secondMacro = buildMacroInfo({
                    name: "second",
                    container: true,
                });

                uut.setCustomMacros("uri-1", [firstMacro]);
                uut.setCustomMacros("uri-2", [secondMacro]);
                const result = uut.all();

                expect(result["first"]).to.eql(firstMacro);
                expect(result["second"]).to.eql(secondMacro);
            });

            it("should parse a custom macro's argument", () => {
                const macro = buildMacroInfo({ name: "first" });
                macro.arguments = ["text"];

                uut.setCustomMacros("uri-1", [macro]);
                const result = uut.all()["first"];

                expect(result.parsedArguments).is.instanceOf(Parameters);
            });

            it("should not parse a custom macro's malformed argument", () => {
                const macro = buildMacroInfo({ name: "first" });
                macro.arguments = ["this-is-not-a-thing"];

                uut.setCustomMacros("uri-1", [macro]);
                const result = uut.all()["first"];

                expect(result.parsedArguments).to.be.undefined;
            });

            it("should delete custom macros from a document when requested", () => {
                const firstMacro = buildMacroInfo({ name: "first" });
                const secondMacro = buildMacroInfo({
                    name: "second",
                    container: true,
                });

                uut.setCustomMacros("uri-1", [firstMacro]);
                uut.setCustomMacros("uri-2", [secondMacro]);
                uut.removeCustomMacroDocument("uri-1");
                const result = uut.all();

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

                expect(result).to.be.an.instanceof(Error);
                expect((result as Error).message).to.include(
                    "No `sugarcube-2` key found"
                );
            });

            it("should return an empty array if there are no macros", () => {
                const yaml = `
sugarcube-2:
`.trimStart();

                const result = uut.tweeConfigFileToMacro(yaml, true);

                expect(Array.isArray(result)).to.be.true;
                expect(result).to.be.empty;
            });

            it("should capture a macro's name even if it differs from the object name", () => {
                const yaml = `
sugarcube-2:
  macros:
    macroname:
      name: othername
`.trimStart();

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(yaml, true);

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

                const result = uut.tweeConfigFileToMacro(json, false);

                expect(result).to.be.an.instanceof(Error);
                expect((result as Error).message).to.include(
                    "No `sugarcube-2` key found"
                );
            });

            it("should return an empty array if there are no macros", () => {
                const json = `{
                  "sugarcube-2": {
                  }
                }`;

                const result = uut.tweeConfigFileToMacro(json, false);

                expect(Array.isArray(result)).to.be.true;
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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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

                const result = uut.tweeConfigFileToMacro(json, false);

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
        });
    });
});
