import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

import { capturePreSemanticTokenFor, StoryFormatParsingState } from "..";
import { EmbeddedDocument } from "../../embedded-languages";
import { tokenizeJavaScript } from "../../js-parser";
import {
    ParseLevel,
    ParsingState,
    createSymbolFor,
    logErrorFor,
    logSemanticTokenFor,
    logWarningFor,
    findAndParseHtml,
    parsePassageReference,
} from "../../parser";
import { ProjectIndex, ProjSymbol } from "../../project-index";
import { ETokenModifier, ETokenType } from "../../semantic-tokens";
import { eraseMatches, versionCompare } from "../../utilities";
import { allMacros, MacroInfo, MacroParent } from "./macros";
import { createVariableAndPropertyReferences } from "./sugarcube-utils";
import { OSugarCubeSymbolKind, SugarCubeSymbolKind } from "./types";
import {
    MacroParse,
    parseSugarCubePassageRefOrTwinescriptExpr,
    parseSugarCubeTwineLink,
    tokenizeMacroArguments,
} from "./sc2/sc2-lexer-parser";
import * as SC2Patterns from "./sc2/sc2-patterns";
import {
    startIsVarRegexp,
    tokenizeTwineScriptExpression,
} from "./sc2/sc2-twinescript";
import {
    Arg as T3LTArg,
    ArgType as T3LTArgType,
    detectArgType,
    macroArgumentTokenToT3LTArg,
    parseMacroParameters,
} from "./sc2/t3lt-parameters";

/**
 * Parse all macro arguments.
 * (Effectively this parses only the built-in macros, as, when this file is loaded,
 * the custom macros aren't available.)
 */
Object.values(allMacros()).map((macro) => {
    if (Array.isArray(macro.arguments)) {
        const parsedArguments = parseMacroParameters(macro.arguments, {}); // Ignore enums since they only apply to custom macros
        if (!(parsedArguments instanceof Error)) {
            macro.parsedArguments = parsedArguments;
        }
    }
});

/**
 * Get SugarCube-specific symbol definitions across all indexed documents.
 *
 * @param kind Kind of SugarCube symbol definitions to return.
 * @param index Project index.
 * @returns List of definitions.
 */
export function getSugarCubeDefinitions(
    kind: SugarCubeSymbolKind,
    index: ProjectIndex
): ProjSymbol[] {
    const symbols: ProjSymbol[] = [];
    for (const uri of index.getIndexedUris()) {
        symbols.push(...(index.getDefinitions(uri, kind) ?? []));
    }
    return symbols;
}

/**
 * Regex to match bare SugarCube 2 variables.
 * Supported syntax:
 *   $variable
 *   $variable.property
 *   $variable[numericIndex]
 *   $variable["property"]
 *   $variable['property']
 *   $variable[$indexOrPropertyVariable]
 *   as well as chained properties and array accessors
 * In any of the above, the `$` sigil (for global variables) can be
 * replaced by `_` (for temporary variables).
 */
const bareVariableRegex = new RegExp(
    [
        `(?:(?<!\\w)${SC2Patterns.variableWithSigil})`, // variable
        `(?:`,
        [
            `(?:\\.(?:${SC2Patterns.identifier}))`, // property
            `(?:\\[(?:\\d+)\\])`, // numeric accessor
            `(?:\\[(?:("|')(?:\\\\.|(?!\\\\|\\1).)+\\1)\\])`, // string accessor
            `(?:\\[(?:${SC2Patterns.variableWithSigil})\\])`, // variable accessor
        ].join("|"),
        `)*`,
    ].join(""),
    "g"
);

/**
 * Parse bare variables.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
function parseBareVariables(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): void {
    for (const m of passageText.matchAll(bareVariableRegex)) {
        createVariableAndPropertyReferences(
            tokenizeTwineScriptExpression(
                m[0],
                m.index + textIndex,
                state.textDocument,
                sugarcubeState
            ),
            state
        );
    }
}

const customStyleRegex = /@@((?:.|\r?\n)*?)@@/gm;
const inlineCssRegex = new RegExp(SC2Patterns.inlineCss, "g");
const singleCssIdOrClass = new RegExp(SC2Patterns.singleCssIdOrClass, "g");

/**
 * Parse custom styles.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
function parseCustomStyles(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): void {
    for (const m of passageText.matchAll(customStyleRegex)) {
        // Capture tokens for the custom style tokens
        capturePreSemanticTokenFor(
            "@@",
            m.index + textIndex,
            ETokenType.decorator,
            [],
            sugarcubeState
        );
        capturePreSemanticTokenFor(
            "@@",
            m.index + m[0].length - 2 + textIndex,
            ETokenType.decorator,
            [],
            sugarcubeState
        );
        // Parse the inline CSS, which has to be contiguous
        let nextIndex = 0; // Where the next match should be for it to be contiguous
        inlineCssRegex.lastIndex = 0;
        let cssMatch: RegExpExecArray | null = null;
        while (
            (cssMatch = inlineCssRegex.exec(m[1])) !== null &&
            cssMatch.index === nextIndex
        ) {
            let curNdx = m.index + 2 + cssMatch.index + textIndex; // +2 for @@
            if (cssMatch[1] !== undefined) {
                curNdx += cssMatch[1].length;
                // Groups 1, 2, 3, 4: [space] style [space:space] value;
                capturePreSemanticTokenFor(
                    cssMatch[2],
                    curNdx,
                    ETokenType.property,
                    [],
                    sugarcubeState
                );
                // This isn't necessarily a string, but go with that for simplicity
                capturePreSemanticTokenFor(
                    cssMatch[4],
                    curNdx + cssMatch[2].length + cssMatch[3].length,
                    ETokenType.string,
                    [],
                    sugarcubeState
                );
            } else {
                // Groups 5, 6:       [space] #id.classname.otherClass; <- can have spaces in between IDs and classnames
                curNdx += cssMatch[5].length;
                // Parse each ID or class
                singleCssIdOrClass.lastIndex = 0;
                for (const idOrClassMatch of cssMatch[6].matchAll(
                    singleCssIdOrClass
                )) {
                    capturePreSemanticTokenFor(
                        idOrClassMatch[0].trimEnd(),
                        curNdx + idOrClassMatch.index,
                        ETokenType.class,
                        [],
                        sugarcubeState
                    );
                }
            }

            nextIndex = cssMatch.index + cssMatch[0].length;
        }
    }
}

/**
 * Parse Twine links and remove them from the text.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns The passage text with Twine links removed.
 */
function parseAndRemoveTwineLinks(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): string {
    // Twine links in SugarCube can include TwineScript, which can have all
    // kinds of array reference shenanigans, so we can't do a simple regex
    // search. Instead, iterate over all possible link-opening sigils
    for (const m of passageText.matchAll(/\[\[[^]/g)) {
        const markupData = parseSugarCubeTwineLink(
            passageText,
            m.index,
            textIndex,
            state,
            sugarcubeState
        );
        if (
            markupData.error === undefined &&
            markupData.isLink &&
            markupData.link !== undefined
        ) {
            // Blank out the link so any variables in it aren't re-parsed
            passageText =
                passageText.slice(0, m.index) +
                " ".repeat(markupData.endPosition - m.index) +
                passageText.slice(markupData.endPosition);
        }
    }

    return passageText;
}

const macroRegex = new RegExp(SC2Patterns.fullMacro, "gm");
const scriptMacroRegex = new RegExp(SC2Patterns.scriptMacroBlock, "gm");

/**
 * Location information about a macro
 */
export interface MacroLocationInfo {
    /**
     * The macro's name (ex: "if")
     */
    name: string;
    /**
     * The full text of a macro (ex: "<<if $v > 1>>")
     */
    fullText: string;
    /**
     * Index where the full text occurs.
     */
    at: number;
    /**
     * Macro ID, to disambiguate macros with the same name
     */
    id: number;
}

/**
 * Parse the arguments to a macro.
 *
 * @param macroName The name of the macro being parsed.
 * @param macroNameIndex Index of the macro's name in the larger document (zero-based).
 * @param args Unparsed arguments.
 * @param argsIndex Index of the unparsed arguments in the larger document (zero-based).
 * @param macroInfo Information about the macro the arguments belong to, if known.
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
function parseMacroArgs(
    macroName: string,
    macroNameIndex: number,
    args: string | undefined,
    argsIndex: number,
    macroInfo: MacroInfo | undefined,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): void {
    // If we have information about a macro and it has a custom parser function, call it
    if (macroInfo?.parse !== undefined) {
        if (macroInfo.parse(args, argsIndex, state, sugarcubeState)) {
            return; // A return of true means we're done parsing
        }
    }

    // If we have information about a macro and its arguments
    // are undefined (which means: don't do anything!), bail
    if (macroInfo !== undefined && macroInfo.arguments === undefined) {
        return;
    }

    // Note that we're going to have to do some mental disambiguation, as there are two
    // sets of arguments/tokens flying around: SC2 and T3LT (which are parsed from the SC2 ones).
    // On top of that, we deal with argument _format_ types, which are combined T3LT ArgTypes and
    // macro parameter types.

    // SugarCube 2 argument tokens
    const sc2ArgumentTokens =
        args !== undefined ? tokenizeMacroArguments(args, argsIndex) : [];

    // If we have macro arguments to parse against, do that first, as we'll use its
    // parsing information to produce semantic tokens and references
    if (macroInfo?.parsedArguments !== undefined) {
        // We got arguments definitions we can validate against
        const t3ltArgsAndErrors = sc2ArgumentTokens.map((t) =>
            macroArgumentTokenToT3LTArg(t, state, sugarcubeState)
        );

        // Since `macroArgumentTokenToT3LTArg()` can produce undefined values if
        // a lexed token doesn't convert to a T3LT macro argument, we need
        // to remove the undefined values and map T3LT macro argument indices
        // to original lexed token indices.
        const t3ltArgs: T3LTArg[] = [];
        const t3ltArgToSC2Token: Record<number, number> = {};
        let argCount = 0;
        for (const [ndx, t3ltArg] of t3ltArgsAndErrors.entries()) {
            if (t3ltArg !== undefined) {
                t3ltArgToSC2Token[argCount++] = ndx;
                t3ltArgs.push(t3ltArg);
            }
        }

        // Validate arguments, capture references and semantic tokens, and log errors
        const validationInfo = macroInfo.parsedArguments.validate(t3ltArgs);
        // eslint-disable-next-line prefer-const
        for (let [t3ltArgNdxStr, t3ltArgFormatType] of Object.entries(
            validationInfo.info.argFormatTypes
        )) {
            const t3ltArgNdx = Number(t3ltArgNdxStr);
            const t3ltArg = t3ltArgs[t3ltArgNdx];
            const sc2Token = sc2ArgumentTokens[t3ltArgToSC2Token[t3ltArgNdx]];
            // t3ltArgFormatType is one of either the T3LT macro ArgType enum values or
            // the macro parameter types, all of which are defined in `t3lt-parameters.ts`

            // If the format type is "text", see if we can figure out what it is and transform it
            if (t3ltArgFormatType === "text") {
                t3ltArgFormatType = detectArgType(sc2Token.text);
            }
            if (
                t3ltArgFormatType === "null" ||
                t3ltArgFormatType === "undefined" ||
                t3ltArgFormatType === "true" ||
                t3ltArgFormatType === "false" ||
                t3ltArgFormatType === "NaN" ||
                t3ltArgFormatType === "bool"
            ) {
                // keyword
                capturePreSemanticTokenFor(
                    sc2Token.text,
                    sc2Token.at,
                    ETokenType.keyword,
                    [],
                    sugarcubeState
                );
            } else if (t3ltArgFormatType === "number") {
                // number
                capturePreSemanticTokenFor(
                    sc2Token.text,
                    sc2Token.at,
                    ETokenType.number,
                    [],
                    sugarcubeState
                );
            } else if (t3ltArgFormatType === "string") {
                // string
                capturePreSemanticTokenFor(
                    sc2Token.text,
                    sc2Token.at,
                    ETokenType.string,
                    [],
                    sugarcubeState
                );
            } else if (t3ltArgFormatType === "var") {
                // variable
                state.callbacks.onSymbolReference(
                    createSymbolFor(
                        sc2Token.text,
                        sc2Token.at,
                        OSugarCubeSymbolKind.Variable,
                        state.textDocument
                    )
                );
                capturePreSemanticTokenFor(
                    sc2Token.text,
                    sc2Token.at,
                    ETokenType.variable,
                    [],
                    sugarcubeState
                );
            } else if (
                t3ltArgFormatType === "link" ||
                t3ltArgFormatType === "linkNoSetter"
            ) {
                // Twine wiki link
                // For simplicity, re-parse it using our utility function so we
                // get all of the semantic tokens and references correct
                parseSugarCubeTwineLink(
                    sc2Token.text,
                    2,
                    sc2Token.at,
                    state,
                    sugarcubeState
                );
            } else if (t3ltArgFormatType === "receiver") {
                // A "$var" in quotes
                if (t3ltArg.type === T3LTArgType.String) {
                    const varName = sc2Token.text.slice(1, -1);
                    const varAt = sc2Token.at + 1;
                    // variable
                    state.callbacks.onSymbolReference(
                        createSymbolFor(
                            varName,
                            varAt,
                            OSugarCubeSymbolKind.Variable,
                            state.textDocument
                        )
                    );
                    capturePreSemanticTokenFor(
                        varName,
                        varAt,
                        ETokenType.variable,
                        [],
                        sugarcubeState
                    );
                } else {
                    // Non-string receivers are okay, but often are a mistake
                    // (see https://github.com/cyrusfirheir/twee3-language-tools/issues/65).
                    // We'll suggest that they should be in back-ticks if they're not
                    if (
                        sc2Token.text[0] === "`" &&
                        sc2Token.text[sc2Token.text.length - 1] === "`"
                    ) {
                        createVariableAndPropertyReferences(
                            tokenizeTwineScriptExpression(
                                sc2Token.text.slice(1, -1),
                                sc2Token.at + 1,
                                state.textDocument,
                                sugarcubeState
                            ),
                            state
                        );
                    } else {
                        logWarningFor(
                            sc2Token.text,
                            sc2Token.at,
                            "Do you mean for this receiver value to be a bare variable? " +
                                `If so, consider surrounding it with back-ticks: \`${sc2Token.text}\``,
                            state
                        );
                        createVariableAndPropertyReferences(
                            tokenizeTwineScriptExpression(
                                sc2Token.text,
                                sc2Token.at,
                                state.textDocument,
                                sugarcubeState
                            ),
                            state
                        );
                    }
                }
            } else if (t3ltArgFormatType === "passage") {
                // A bareword, string (the passage name is in the string), NaN, or number (sure)
                let passageName: string | undefined;
                let passageAt = sc2Token.at;
                if (t3ltArg.type === T3LTArgType.Bareword) {
                    passageName = t3ltArg.value;
                } else if (t3ltArg.type === T3LTArgType.String) {
                    passageName = t3ltArg.text;
                    passageAt++; // To skip the leading quote
                } else if (t3ltArg.type === T3LTArgType.NaN) {
                    passageName = String(NaN);
                } else if (t3ltArg.type === T3LTArgType.Number) {
                    passageName = String(t3ltArg.value);
                }
                if (passageName !== undefined) {
                    passageName = passageName.replace(/\\/g, "");
                    parsePassageReference(
                        passageName,
                        passageAt,
                        state,
                        sugarcubeState
                    );
                }
            } else if (t3ltArg.type === T3LTArgType.Expression) {
                // We got a `backtick expression` (which we parse regardless of what kind of T3LT arg type it mapped to)
                createVariableAndPropertyReferences(
                    tokenizeTwineScriptExpression(
                        sc2Token.text.slice(1, -1), // Remove the backticks
                        sc2Token.at + 1,
                        state.textDocument,
                        sugarcubeState
                    ),
                    state
                );
            }
        }

        for (const error of validationInfo.info.errors) {
            const errorToken =
                sc2ArgumentTokens[t3ltArgToSC2Token[error.index] ?? 0];
            if (errorToken === undefined) {
                logErrorFor(args ?? "", argsIndex, error.error.message, state);
            } else {
                logErrorFor(
                    errorToken.text,
                    errorToken.at,
                    error.error.message,
                    state
                );
            }
        }
        for (const warning of validationInfo.info.warnings) {
            const warningToken =
                sc2ArgumentTokens[t3ltArgToSC2Token[warning.index] ?? 0];
            if (warningToken === undefined) {
                logErrorFor(
                    args ?? "",
                    argsIndex,
                    warning.warning.message,
                    state
                );
            } else {
                logErrorFor(
                    warningToken.text,
                    warningToken.at,
                    warning.warning.message,
                    state
                );
            }
        }

        return;
    }

    for (const arg of sc2ArgumentTokens) {
        if (arg.type === MacroParse.Item.Error) {
            logErrorFor(
                arg.text,
                arg.at,
                arg.message ?? "Unknown macro argument parsing error",
                state
            );
        } else if (arg.type === MacroParse.Item.Bareword) {
            let [vars, props] = tokenizeTwineScriptExpression(
                arg.text,
                arg.at,
                state.textDocument,
                sugarcubeState
            );

            // Discard any variables that don't start with `$` or `_` (or `settings` or `setup`) and properties whose
            // scope doesn't start with the same. If it's not a variable, also get rid of the associated semantic token
            vars = vars.filter((v) => {
                const isVar = startIsVarRegexp.test(v.contents);
                if (!isVar) {
                    delete sugarcubeState.passageTokens[arg.at];
                }
                return isVar;
            });
            props = props.filter(
                (p) => p.scope && startIsVarRegexp.test(p.scope)
            );

            createVariableAndPropertyReferences([vars, props], state);
        } else if (arg.type === MacroParse.Item.Expression) {
            // TwineScript code inside backticks
            createVariableAndPropertyReferences(
                tokenizeTwineScriptExpression(
                    arg.text.slice(1, -1),
                    arg.at + 1,
                    state.textDocument,
                    sugarcubeState
                ),
                state
            );
        } else if (arg.type === MacroParse.Item.String) {
            capturePreSemanticTokenFor(
                arg.text,
                arg.at,
                ETokenType.string,
                [],
                sugarcubeState
            );
        } else if (arg.type === MacroParse.Item.SquareBracket) {
            // If the macro arguments won't later be parsed to be compared to the
            // macro's possible parameters, then we parse the square bracket items
            // to capture their semantic tokens and passage references.
            parseSugarCubeTwineLink(arg.text, 0, arg.at, state, sugarcubeState);
        }
    }

    if (macroInfo?.arguments === true) {
        if (args === undefined || !args.trim()) {
            logWarningFor(
                macroName,
                macroNameIndex,
                "Expected arguments",
                state
            );
        }
    } else if (macroInfo?.arguments === false) {
        if (args !== undefined && args.trim()) {
            logWarningFor(args, argsIndex, "Expected no arguments", state);
        }
    }
}

/**
 * Parse SugarCube macros.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns The passage text with macros removed.
 */
function parseMacros(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): string {
    const knownMacros = allMacros();

    // Special case the <<script>> container, as its contents are treated as raw JavaScript/TwineScript
    for (const m of passageText.matchAll(scriptMacroRegex)) {
        if (m.groups !== undefined) {
            const isTwinescript =
                (m.groups.language ?? "").toLowerCase() === "twinescript";
            const open = m.groups.open ?? "";
            const contents = m.groups.contents ?? "";
            const contentsIndex = m.index + open.length;
            if (isTwinescript) {
                createVariableAndPropertyReferences(
                    tokenizeTwineScriptExpression(
                        contents,
                        contentsIndex + textIndex,
                        state.textDocument,
                        sugarcubeState
                    ),
                    state
                );
            } else {
                // Tokenize as a JavaScript program but don't capture vars
                tokenizeJavaScript(
                    true,
                    contents,
                    contentsIndex + textIndex,
                    state.textDocument,
                    sugarcubeState
                );
            }

            // Get rid of the <<script>> contents in the passage text that we'll return
            passageText =
                passageText.slice(0, contentsIndex) +
                " ".repeat(contents.length) +
                passageText.slice(contentsIndex + contents.length);
        }
    }

    let macroId = 0;
    const unclosedMacros: MacroLocationInfo[] = [];
    const macroChildren: Record<number, MacroLocationInfo[]> = {}; // Map of parent macro ID to list of child macros
    for (const m of passageText.matchAll(macroRegex)) {
        const macroIndex = m.index + 2; // Index of the start of the macro (inside the <<)

        // macroName: name of the macro
        // macroBody: the body of the macro (e.g. its arguments)
        // macroEnd: "end" or "/" at the start of the macro (e.g. <</if>>)
        // macroSelfClose: "/" at the end of the macro
        const { macroName, preMacroBodySpace, macroBody, macroEnd } =
            m.groups as {
                [key: string]: string;
            };

        const macroBodyIndex =
            macroIndex +
            (macroEnd ?? "").length +
            macroName.length +
            preMacroBodySpace.length;

        let isOpenMacro = true, // whether the macro is an opening one (i.e. not a close or self-closing one)
            endVariant = false, // whether it's one that starts with "end"
            name = macroName;

        // Handle e.g. "<<endif>>" alternate ending macros
        // n.b. we need to do special handling because some macros may start with the letters "end"
        // and not be literally ending a container macro
        if (macroEnd === "end") {
            const defInList = knownMacros[macroName]; // Macro definition for the name without "end" (if known)
            const endAddedName = macroEnd + macroName; // e.g. "endif"
            if (defInList) {
                // if it's a container, mark this macro as being an endVariant and mention that it's deprecated
                if (defInList.container) {
                    endVariant = true;
                    logWarningFor(
                        m[0],
                        m.index + textIndex,
                        `<<end${macroName}>> is deprecated; use <</${macroName}>> instead`,
                        state
                    );
                } else if (knownMacros[endAddedName] === undefined) {
                    name = endAddedName; // double check there's no known macro with "end" at the start
                }
            } else {
                name = endAddedName;
            }
        }

        const macroInfo = knownMacros[name];

        if (macroEnd === "/" || endVariant) isOpenMacro = false; // Note if we know this is a closing macro

        // Capture a reference to the macro
        if (isOpenMacro) {
            state.callbacks.onSymbolReference(
                createSymbolFor(
                    name,
                    textIndex + macroIndex,
                    macroInfo !== undefined
                        ? OSugarCubeSymbolKind.KnownMacro
                        : OSugarCubeSymbolKind.UnknownMacro,
                    state.textDocument
                )
            );
        }

        // Capture semantic tokens for the macro itself
        const deprecated =
            state.storyFormat?.formatVersion !== undefined &&
            macroInfo?.deprecated !== undefined &&
            versionCompare(
                state.storyFormat.formatVersion,
                macroInfo.deprecated
            ) <= 0;
        capturePreSemanticTokenFor(
            (macroEnd ?? "") + macroName,
            textIndex + macroIndex,
            ETokenType.function,
            deprecated ? [ETokenModifier.deprecated] : [],
            sugarcubeState
        );

        if (macroInfo !== undefined) {
            // Check for macros that have been removed or aren't yet available
            const storyFormatVersion = state.storyFormat?.formatVersion;
            if (storyFormatVersion !== undefined && isOpenMacro) {
                if (
                    macroInfo.since !== undefined &&
                    versionCompare(storyFormatVersion, macroInfo.since) < 0
                ) {
                    logErrorFor(
                        m[0],
                        m.index + textIndex,
                        `\`${macroInfo.name}\` isn't available until SugarCube version ${macroInfo.since} but your StoryFormat version is ${storyFormatVersion}`,
                        state
                    );
                } else if (
                    macroInfo.removed !== undefined &&
                    versionCompare(storyFormatVersion, macroInfo.removed) >= 0
                ) {
                    logErrorFor(
                        m[0],
                        m.index + textIndex,
                        `\`${macroInfo.name}\` was removed in SugarCube version ${macroInfo.removed} and your StoryFormat version is ${storyFormatVersion}`,
                        state
                    );
                }
            }

            // Handle open/close macros
            if (macroInfo.container) {
                if (isOpenMacro) {
                    unclosedMacros.push({
                        name: macroInfo.name,
                        at: m.index,
                        fullText: m[0],
                        id: macroId++,
                    });
                } else {
                    let openingMacroFound = false;
                    for (let i = unclosedMacros.length - 1; i >= 0; --i) {
                        if (unclosedMacros[i].name === macroInfo.name) {
                            // If the macro has a container parser, pass it the kids.
                            if (macroInfo.parseChildren !== undefined) {
                                const children =
                                    macroChildren[unclosedMacros[i].id] ?? [];
                                // Shift the kids' locations to be relative to
                                // the document instead of the passage text
                                for (const child of children) {
                                    child.at += textIndex;
                                }
                                macroInfo.parseChildren(
                                    children,
                                    state,
                                    sugarcubeState
                                );
                            }
                            delete macroChildren[unclosedMacros[i].id];
                            openingMacroFound = true;
                            unclosedMacros.splice(i, 1);
                            break;
                        }
                    }
                    if (!openingMacroFound) {
                        logErrorFor(
                            m[0],
                            m.index + textIndex,
                            `Opening macro <<${macroInfo.name}>> not found`,
                            state
                        );
                    }
                }
            } else if (!isOpenMacro) {
                // If a macro isn't a container, it can't have a closing macro
                logErrorFor(
                    m[0],
                    m.index + textIndex,
                    `<<${macroInfo.name}>> macro isn't a container and so doesn't have a closing macro`,
                    state
                );
            }

            // Handle child macros
            if (macroInfo.parents) {
                // Make sure we're within our parent
                const parentNames = macroInfo.parents.map((p) =>
                    MacroParent.is(p) ? p.name : p
                );
                let parentMacroInfo: MacroLocationInfo | undefined;
                for (let i = unclosedMacros.length - 1; i >= 0; --i) {
                    if (parentNames.includes(unclosedMacros[i].name)) {
                        parentMacroInfo = unclosedMacros[i];
                        break;
                    }
                }
                if (parentMacroInfo !== undefined) {
                    // Record the child and check the number of times it's appeared (if there's a limit)
                    if (macroChildren[parentMacroInfo.id] === undefined) {
                        macroChildren[parentMacroInfo.id] = [];
                    }
                    macroChildren[parentMacroInfo.id].push({
                        name: macroInfo.name,
                        at: m.index,
                        fullText: m[0],
                        id: macroId++,
                    });
                    const macroParent = macroInfo.parents.find(
                        (p) =>
                            MacroParent.is(p) && p.name === parentMacroInfo.name
                    );
                    if (MacroParent.is(macroParent)) {
                        // Make sure we don't have too many of the same kind of child macro
                        const childCount = macroChildren[
                            parentMacroInfo.id
                        ].filter((info) => info.name === macroInfo.name).length;
                        if (childCount > macroParent.max) {
                            logErrorFor(
                                m[0],
                                m.index + textIndex,
                                `Child macro <<${macroName}>> can be used at most ${macroParent.max} time${macroParent.max > 1 ? "s" : ""}`,
                                state
                            );
                        }
                    }
                } else {
                    let errorMessage = `Must be inside <<${parentNames[0]}>> macro`;
                    if (parentNames.length > 1) {
                        errorMessage =
                            "Must be inside one of the following macros: " +
                            parentNames.map((name) => `<<${name}>>`).join(", ");
                    }
                    logErrorFor(m[0], m.index + textIndex, errorMessage, state);
                }
            }
        }

        // Handle arguments, if any. (We call this even if there are no
        // arguments b/c the macro may expect arguments)
        if (isOpenMacro) {
            parseMacroArgs(
                (macroEnd ?? "") + macroName,
                macroIndex + textIndex,
                macroBody,
                macroBodyIndex + textIndex,
                macroInfo,
                state,
                sugarcubeState
            );
        } else if (macroBody.trim()) {
            logWarningFor(
                macroBody,
                macroBodyIndex + textIndex,
                "Closing macros don't take arguments",
                state
            );
        }

        // Erase the macro from the string so we don't double parse its contents
        passageText =
            passageText.slice(0, m.index) +
            " ".repeat(m[0].length) +
            passageText.slice(m.index + m[0].length);
    }

    // If we have any lingering open tags, they're missing their close tags
    for (const openTag of unclosedMacros) {
        logErrorFor(
            openTag.fullText,
            openTag.at + textIndex,
            `Closing macro <</${openTag.name}>> not found`,
            state
        );
    }

    return passageText;
}

const htmlTagRegex = new RegExp(SC2Patterns.htmlTag, "gm");
const sc2AttrsAndDirectives = new RegExp(
    `(data-(?:passage|setter)|(@|sc-eval:)${SC2Patterns.htmlAttrName})\\s*=\\s*(${SC2Patterns.htmlAttrValue})`,
    "g"
);
const hrefAttr = new RegExp(
    `\\bhref(?:\\s*=\\s*${SC2Patterns.htmlAttrValue})?`
);

/**
 * Parse HTML attributes and attribute directives.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns The passage text with the attributes and attribute directives removed.
 */
function parseHtmlAttributesAndDirectives(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): string {
    for (const m of passageText.matchAll(htmlTagRegex)) {
        const tag = m[0];
        const tagIndex = m.index;
        for (const m1 of tag.matchAll(sc2AttrsAndDirectives)) {
            const attrIndex = tagIndex + m1.index;
            const attrName = m1[1];
            const evalDirective = m1[2];
            let attrContents = m1[3];
            let attrContentsIndex =
                attrIndex + m1[0].length - attrContents.length;
            if (attrContents[0] === '"' || attrContents[0] === "'") {
                attrContents = attrContents.slice(1, -1);
                attrContentsIndex++;
            }

            // data-passage can be a passage or TwineScript.
            // Everything else gets treated as TwineScript.
            if (attrName === "data-passage") {
                parseSugarCubePassageRefOrTwinescriptExpr(
                    attrContents,
                    textIndex + attrContentsIndex,
                    state,
                    sugarcubeState
                );
                // Make sure we don't have an href attribute, too
                if (hrefAttr.test(tag)) {
                    logErrorFor(
                        attrName,
                        textIndex + attrIndex,
                        `Both "data-passage" and "href" attributes aren't allowed`,
                        state
                    );
                }
            } else {
                createVariableAndPropertyReferences(
                    tokenizeTwineScriptExpression(
                        attrContents,
                        textIndex + attrContentsIndex,
                        state.textDocument,
                        sugarcubeState
                    ),
                    state
                );
                // Make sure we don't have an evaluation directive on a data-setter attribute
                if (
                    evalDirective !== undefined &&
                    attrName.endsWith("data-setter")
                ) {
                    logErrorFor(
                        evalDirective,
                        textIndex + attrIndex,
                        `"data-setter" can't have an evaluation directive`,
                        state
                    );
                }
            }

            passageText =
                passageText.slice(0, attrIndex) +
                " ".repeat(m1[0].length) +
                passageText.slice(attrIndex + m1[0].length);
        }
    }

    return passageText;
}

const noParseRegex = new RegExp(
    [SC2Patterns.noWikiBlock, SC2Patterns.htmlScriptStyleBlock].join("|"),
    "gmi"
);

const commentRegex = new RegExp(SC2Patterns.commentBlock, "gmi");

/**
 * Remove all text that we won't parse for SugarCube contents.
 *
 * This includes:
 *   - `"""remove"""`
 *   - `<nowiki>remove</nowiki>`
 *   - `{{{remove}}}`
 *   - `<style>remove</style>`
 *   - `<script>remove</script>`
 *   - `<html>remove</html>`
 *   - `/* remove * /`
 *   - `/% remove %/`
 *   - `<!-- remove -->`
 *
 * @param text Text to remove unparsed text from.
 * @returns The subsection with unparsed text blanked out.
 */
function removeNonParsedText(
    text: string,
    textIndex: number,
    sugarcubeState: StoryFormatParsingState
): string {
    text = eraseMatches(text, noParseRegex);

    // We need to produce semantic tokens for comments
    return eraseMatches(text, commentRegex, (m) => {
        if (m !== null) {
            capturePreSemanticTokenFor(
                m[0],
                m.index + textIndex,
                ETokenType.comment,
                [],
                sugarcubeState
            );
        }
    });
}

/**
 * Check for special passages and whether the special passage doesn't require additional processing.
 *
 * @param state Parsing state.
 * @returns True if the passage shouldn't be further processed.
 */
function checkForSpecialPassages(state: ParsingState): boolean {
    if (
        state.currentPassage !== undefined &&
        state.storyFormat?.formatVersion !== undefined
    ) {
        if (
            state.currentPassage.name.contents === "StoryDisplayTitle" &&
            versionCompare(state.storyFormat.formatVersion, "2.31.0") < 0
        ) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    state.currentPassage.name.location.range,
                    `StoryDisplayTitle isn't supported in SugarCube version ${state.storyFormat.formatVersion}`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                )
            );
        }

        if (
            state.currentPassage.name.contents === "StoryInterface" &&
            versionCompare(state.storyFormat.formatVersion, "2.18.0") < 0
        ) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    state.currentPassage.name.location.range,
                    `StoryInterface isn't supported in SugarCube version ${state.storyFormat.formatVersion}`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                )
            );
        }

        if (
            state.currentPassage.name.contents === "StoryShare" &&
            versionCompare(state.storyFormat.formatVersion, "2.37.0") >= 0
        ) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    state.currentPassage.name.location.range,
                    `StoryShare is deprecated as of SugarCube version 2.37.0`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                )
            );
        }
    }

    // We do no additional parsing for StoryInterface passages, as it's treated as raw HTML
    return state.currentPassage?.name.contents === "StoryInterface";
}

/**
 * Passage tags that correspond to a media passage.
 */
const mediaPassageTags = new Set([
    "Twine.audio",
    "Twine.image",
    "Twine.video",
    "Twine.vtt",
]);

/**
 * Check a passage's tags and generate any needed embedded documents
 * for the entire passage.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
function checkPassageTags(
    passageText: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): void {
    let isHtmlPassage = true;

    const tags = state.currentPassage?.tags ?? [];
    const tagNames = tags.map((t) => t.contents);
    const mediaTags = tags.filter((x) => mediaPassageTags.has(x.contents));
    if (tagNames.includes("script")) {
        // We'll tokenize the contents as a program, but not capture variable and
        // property references
        tokenizeJavaScript(
            true,
            passageText,
            textIndex,
            state.textDocument,
            sugarcubeState
        );
        isHtmlPassage = false;
    } else if (tagNames.includes("stylesheet")) {
        state.callbacks.onEmbeddedDocument(
            EmbeddedDocument.create(
                "stylesheet",
                "css",
                passageText,
                textIndex,
                state.textDocument
            )
        );
        isHtmlPassage = false;
    } else if (mediaTags.length === 1) {
        isHtmlPassage = false;
        // Of the media tags, only Twine.image was originally in 2.0.0. The others
        // were added in 2.24.0
        if (
            mediaTags[0].contents !== "Twine.image" &&
            state.storyFormat?.formatVersion !== undefined &&
            versionCompare(state.storyFormat.formatVersion, "2.24.0") < 0
        ) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    mediaTags[0].location.range,
                    `${mediaTags[0].contents} isn't supported in SugarCube version ${state.storyFormat.formatVersion}`,
                    DiagnosticSeverity.Warning,
                    undefined,
                    "Twine"
                )
            );
        }
    } else if (mediaTags.length > 1) {
        isHtmlPassage = false;
        // We only allow one media tag
        for (const tag of mediaTags) {
            state.callbacks.onParseError(
                Diagnostic.create(
                    tag.location.range,
                    `Multiple media passage tags aren't allowed`,
                    DiagnosticSeverity.Error,
                    undefined,
                    "Twine"
                )
            );
        }
    } else if (
        tagNames.includes("bookmark") &&
        state.storyFormat?.formatVersion !== undefined &&
        versionCompare(state.storyFormat.formatVersion, "2.37.0") >= 0
    ) {
        const ndx = tagNames.indexOf("bookmark");
        state.callbacks.onParseError(
            Diagnostic.create(
                tags[ndx].location.range,
                `bookmark is deprecated as of SugarCube version 2.37.0`,
                DiagnosticSeverity.Warning,
                undefined,
                "Twine"
            )
        );
    }

    // Generate an embedded HTML document for the entire passage if needed
    if (isHtmlPassage)
        state.callbacks.onEmbeddedDocument(
            EmbeddedDocument.create(
                (state.currentPassage?.name.contents ?? "placeholder").replace(
                    " ",
                    "-"
                ),
                "html",
                passageText,
                textIndex,
                state.textDocument,
                true
            )
        );
}

/**
 * Parse the text of a Chapbook passage.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 */
export function parsePassageText(
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    if (state.parseLevel !== ParseLevel.Full) {
        return;
    }

    const sugarcubeState: StoryFormatParsingState = {
        passageTokens: {},
    };

    // Check for special tags and create any needed embedded documents
    checkPassageTags(passageText, textIndex, state, sugarcubeState);

    // Check for special passages, and stop processing if the special passage processing is done
    if (checkForSpecialPassages(state)) return;

    // This parsing order mostly matches that of the SC2 Wikifier Parser (`parserlib.js`)

    passageText = findAndParseHtml(passageText, textIndex, state);

    // The above gets rid of pure <style> tags; now take care
    // of <script>, verbatim <html>, no-wiki text, and comments

    passageText = removeNonParsedText(passageText, textIndex, sugarcubeState);

    passageText = parseHtmlAttributesAndDirectives(
        passageText,
        textIndex,
        state,
        sugarcubeState
    );

    passageText = parseMacros(passageText, textIndex, state, sugarcubeState);

    passageText = parseAndRemoveTwineLinks(
        passageText,
        textIndex,
        state,
        sugarcubeState
    );

    parseCustomStyles(passageText, textIndex, state, sugarcubeState);

    parseBareVariables(passageText, textIndex, state, sugarcubeState);

    // Submit semantic tokens in document order
    // (taking advantage of object own key enumeration order)
    for (const t of Object.values(sugarcubeState.passageTokens)) {
        logSemanticTokenFor(t.text, t.at, t.type, t.modifiers, state);
    }
}
