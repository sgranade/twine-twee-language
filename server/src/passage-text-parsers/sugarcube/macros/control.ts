import {
    DiagnosticRelatedInformation,
    Location,
    Range,
} from "vscode-languageserver";

import { createDiagnosticFor, DiagnosticCodes } from "../../../diagnostics";
import { TokenizedJS } from "../../../js-parser";
import { logDiagnosticFor, logRawDiagnostic } from "../../../parser";
import { skipSpaces } from "../../../utilities";
import { MacroLocationInfo } from "../sugarcube-parser";
import { createVariableAndPropertyReferences } from "../sugarcube-utils";
import { forMacroIsRange, forMacroRangeFormat } from "../sc2/sc2-patterns";
import { tokenizeTwineScriptExpression } from "../sc2/sc2-twinescript";
import { MacroInfo, parseArgsAsTwineScriptExpression } from "./types";

export const ifMacro: MacroInfo = {
    name: "if",
    container: true,
    syntax: "<<if conditional>> … [<<elseif conditional>> …] [<<else>> …] <</if>>",
    description:
        "Executes its contents if the given conditional expression evaluates to true. If the condition evaluates to false and an `<<elseif>>` or `<<else>>` exists, then other contents can be executed.",
    since: "2.0.0",
    parseArgs: parseArgsAsTwineScriptExpression,
    parseChildren(children, state) {
        // An <<elseif>> after an <<else>> is an error
        let elseifMacro: MacroLocationInfo | undefined;
        let elseifIndex: number | undefined;
        for (const [index, kid] of children.entries()) {
            if (kid.name === "elseif") {
                elseifMacro = kid;
                elseifIndex = index;
            }
        }
        if (elseifMacro !== undefined) {
            for (let i = elseifIndex! - 1; i >= 0; --i) {
                if (children[i].name === "else") {
                    const diagnostic = createDiagnosticFor(
                        DiagnosticCodes.SugarCubeElseIfAfterElse,
                        elseifMacro.fullText,
                        elseifMacro.at,
                        state.textDocument,
                    );
                    diagnostic.relatedInformation = [
                        DiagnosticRelatedInformation.create(
                            Location.create(
                                state.textDocument.uri,
                                Range.create(
                                    state.textDocument.positionAt(
                                        children[i].at,
                                    ),
                                    state.textDocument.positionAt(
                                        children[i].at +
                                            children[i].fullText.length,
                                    ),
                                ),
                            ),
                            "The <<else>> before this <<elseif>>",
                        ),
                    ];
                    logRawDiagnostic(diagnostic, state);
                }
            }
        }
    },
};

export const elseifMacro: MacroInfo = {
    name: "elseif",
    parents: ["if"],
    syntax: "<<elseif conditional>>",
    description:
        "Executes its contents if the given conditional expression evaluates to true.",
    since: "2.0.0",
    parseArgs: parseArgsAsTwineScriptExpression,
};

export const elseMacro: MacroInfo = {
    name: "else",
    arguments: false,
    parents: [
        {
            name: "if",
            max: 1,
        },
    ],
    syntax: "<<else>>",
    description:
        "Executes its contents if none of the previous `<<if>>` or `<<elseif>>` macros executed.",
    since: "2.0.0",
};

const forMacroIsRangeRegex = new RegExp(forMacroIsRange);
const forMacroRangeFormatRegex = new RegExp(forMacroRangeFormat, "d");
const forMacroInOfRegex = /^\S+\s+(in|of)\s+\S+/i;

export const forMacro: MacroInfo = {
    name: "for",
    container: true,
    syntax: "<<for [conditional]>> … <</for>>\n<<for [init] ; [conditional] ; [post]>> … <</for>>\n<<for [keyVariable ,] valueVariable range collection>> … <</for>>",
    description:
        "Repeatedly executes its contents. There are three forms: a conditional-only form, a 3-part conditional form, and a range form.",
    since: "2.0.0",
    parseArgs(args, argsIndex, state, sugarcubeState) {
        if (args) {
            [args, argsIndex] = skipSpaces(args.trimEnd(), argsIndex);
        }
        if (!args) return true;

        if (forMacroIsRangeRegex.test(args)) {
            // Range form
            const m = args.match(forMacroRangeFormatRegex);
            if (m === null) {
                logDiagnosticFor(
                    DiagnosticCodes.SugarCubeIncorrectRangeSyntax,
                    args,
                    argsIndex,
                    state,
                );
            } else {
                const jsTokens: TokenizedJS = { variables: [], properties: [] };
                // Groups match `[[1], 2] range 3`
                if (m[1]) {
                    // index
                    const indexTokens = tokenizeTwineScriptExpression(
                        m[1],
                        argsIndex + (m.indices?.at(1)?.at(0) ?? 0),
                        state.textDocument,
                        sugarcubeState,
                    );
                    jsTokens.variables = indexTokens.variables;
                    jsTokens.properties = indexTokens.properties;
                }
                if (m[2]) {
                    // value
                    const valueTokens = tokenizeTwineScriptExpression(
                        m[2],
                        argsIndex + (m.indices?.at(2)?.at(0) ?? 0),
                        state.textDocument,
                        sugarcubeState,
                    );
                    jsTokens.variables = [
                        ...jsTokens.variables,
                        ...valueTokens.variables,
                    ];
                    jsTokens.properties = [
                        ...jsTokens.properties,
                        ...valueTokens.properties,
                    ];
                }
                // We're creating the index and value variables/properties
                for (const v of jsTokens.variables) {
                    v.defined = true;
                }
                for (const p of jsTokens.properties) {
                    p.defined = true;
                }
                createVariableAndPropertyReferences(
                    jsTokens,
                    state,
                    sugarcubeState,
                );

                if (m[3]) {
                    // collection
                    createVariableAndPropertyReferences(
                        tokenizeTwineScriptExpression(
                            m[3],
                            argsIndex + (m.indices?.at(3)?.at(0) ?? 0),
                            state.textDocument,
                            sugarcubeState,
                        ),
                        state,
                        sugarcubeState,
                    );
                }
            }
        } else {
            // Conditional forms
            if (args.indexOf(";") === -1) {
                // Single condition
                // Make sure they didn't accidentally use "for x in y" or "for x of y" syntax
                const m = args.match(forMacroInOfRegex);
                if (m !== null) {
                    logDiagnosticFor(
                        DiagnosticCodes.SugarCubeNoForInOf,
                        args,
                        argsIndex + (m.index ?? 0),
                        state,
                        `\`for...${m[1]}\` syntax isn't supported; try \`for...range\``,
                    );
                    return true; // Bail out
                }
            } else {
                // Three-part conditional. We'll turn it into a standard for() statement
                // and let the TwineScript parser parse it
                args = `for(${args}){}`;
                argsIndex -= 4;
            }
            createVariableAndPropertyReferences(
                tokenizeTwineScriptExpression(
                    args,
                    argsIndex,
                    state.textDocument,
                    sugarcubeState,
                    true,
                    true,
                ),
                state,
                sugarcubeState,
            );
        }
        return true;
    },
};

export const breakMacro: MacroInfo = {
    name: "break",
    arguments: false,
    parents: ["for"],
    syntax: "<<break>>",
    description:
        "Used within `<<for>>` macros. Terminates the execution of the current `<<for>>`.",
    since: "2.0.0",
};

export const continueMacro: MacroInfo = {
    name: "continue",
    arguments: false,
    parents: ["for"],
    syntax: "<<continue>>",
    description:
        "Used within `<<for>>` macros. Terminates the execution of the current iteration of the current `<<for>>` and begins execution of the next iteration.",
    since: "2.0.0",
};

export const switchMacro: MacroInfo = {
    name: "switch",
    container: true,
    syntax: "<<switch expression>>\n\t[<<case valueList>> …]\n\t[<<default>> …]\n<</switch>>",
    description:
        "Evaluates the given expression and compares it to the value(s) within its `<<case>>` children. The value(s) within each case are compared to the result of the expression given to the parent `<<switch>>`. Upon a successful match, the matching case will have its contents executed. If no cases match and an optional `<<default>>` case exists, which must be the final case, then its contents will be executed. At most one case will execute.",
    since: "2.7.2",
    parseArgs: parseArgsAsTwineScriptExpression,
};

export const caseMacro: MacroInfo = {
    name: "case",
    parents: ["switch"],
    syntax: "<<case>>",
    description:
        "Executes its contents if the value of the parent `<<switch>>` macro evaluates to one of the `<<case>>` values.",
    since: "2.7.2",
    arguments: ["(text|var|number|undefined) &+ ...text|var|number|undefined"],
};

export const defaultMacro: MacroInfo = {
    name: "default",
    arguments: false,
    parents: [{ name: "switch", max: 1 }],
    syntax: "<<default>>",
    description:
        "Executes its contents if none of the `<<case>>` macros match the value of the parent `<<switch>>` macro.",
    since: "2.7.2",
};
