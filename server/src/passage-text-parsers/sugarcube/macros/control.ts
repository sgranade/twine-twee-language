import {
    DiagnosticRelatedInformation,
    DiagnosticSeverity,
    Location,
    Range,
} from "vscode-languageserver";

import { createDiagnosticFor } from "../../../utilities";
import { MacroLocationInfo } from "../sugarcube-parser";
import { MacroInfo, parseArgsAsTwineScriptExpression } from "./types";

export const ifMacro: MacroInfo = {
    name: "if",
    container: true,
    syntax: "<<if conditional>> … [<<elseif conditional>> …] [<<else>> …] <</if>>",
    description:
        "Executes its contents if the given conditional expression evaluates to true. If the condition evaluates to false and an `<<elseif>>` or `<<else>>` exists, then other contents can be executed.",
    since: "2.0.0",
    parse: parseArgsAsTwineScriptExpression,
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
                        DiagnosticSeverity.Error,
                        state.textDocument,
                        elseifMacro.fullText,
                        elseifMacro.at,
                        "<<elseif>> can't come after an <<else>>"
                    );
                    diagnostic.relatedInformation = [
                        DiagnosticRelatedInformation.create(
                            Location.create(
                                state.textDocument.uri,
                                Range.create(
                                    state.textDocument.positionAt(
                                        children[i].at
                                    ),
                                    state.textDocument.positionAt(
                                        children[i].at +
                                            children[i].fullText.length
                                    )
                                )
                            ),
                            "The <<else>> before this <<elseif>>"
                        ),
                    ];
                    state.callbacks.onParseError(diagnostic);
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
    parse: parseArgsAsTwineScriptExpression,
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

export const forMacro: MacroInfo = {
    name: "for",
    container: true,
    arguments: true,
    syntax: "<<for [conditional]>> … <</for>>\n<<for [init] ; [conditional] ; [post]>> … <</for>>\n<<for [keyVariable ,] valueVariable range collection>> … <</for>>",
    description:
        "Repeatedly executes its contents. There are three forms: a conditional-only form, a 3-part conditional form, and a range form.",
    since: "2.0.0",
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
    parse: parseArgsAsTwineScriptExpression,
};

export const caseMacro: MacroInfo = {
    name: "case",
    parents: ["switch"],
    syntax: "<<case>>",
    description:
        "Executes its contents if the value of the parent `<<switch>>` macro evaluates to one of the `<<case>>` values.",
    since: "2.7.2",
    arguments: ["(text | var) &+ ...(text | var)"],
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
