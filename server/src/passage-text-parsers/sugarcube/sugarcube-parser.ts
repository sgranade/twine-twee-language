import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";

import { capturePreSemanticTokenFor, StoryFormatParsingState } from "..";
import { EmbeddedDocument } from "../../embedded-languages";
import { JSPropertyLabel, tokenizeJSExpression } from "../../js-parser";
import {
    ParseLevel,
    ParsingState,
    createSymbolFor,
    logErrorFor,
    logSemanticTokenFor,
    logWarningFor,
    parsePassageReference,
} from "../../parser";
import { Label } from "../../project-index";
import { ETokenModifier, ETokenType, TokenType } from "../../semantic-tokens";
import { eraseMatches, versionCompare } from "../../utilities";
import { all as allMacros, MacroInfo, MacroParent } from "./macros";
import { OSugarCubeSymbolKind, SugarCubeSymbolKind } from "./types";
import {
    LinkMarkupData,
    MacroParse,
    parseSquareBracketedMarkup,
    tokenizeMacroArguments,
} from "./sc2/sc2-lexer-parser";
import { sc2Patterns } from "./sc2/sc2-patterns";
import { tokenizeTwineScriptExpression } from "./sc2/sc2-twinescript";

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
 * Create symbol references for parsed variables and properties.
 *
 * @param varsAndProps Tuple with separate lists of variables and properties.
 * @param state Parsing state.
 */
function createVariableAndPropertyReferences(
    varsAndProps: [Label[], JSPropertyLabel[]],
    state: ParsingState
): void {
    for (const v of varsAndProps[0]) {
        state.callbacks.onSymbolReference({
            contents: v.contents,
            location: v.location,
            kind: OSugarCubeSymbolKind.Variable,
        });
    }
    for (const p of varsAndProps[1]) {
        // If there's a scope, add it to the name, b/c we save properties in their
        // full object context (ex: `var.prop.subprop`).
        const contents =
            p.scope !== undefined ? `${p.scope}.${p.contents}` : p.contents;
        state.callbacks.onSymbolReference({
            contents: contents,
            location: p.location,
            kind: OSugarCubeSymbolKind.Property,
        });
    }
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
        `(?:${sc2Patterns.variableWithSigil})`, // variable
        `(?:`,
        [
            `(?:\\.(?:${sc2Patterns.identifier}))`, // property
            `(?:\\[(?:\\d+)\\])`, // numeric accessor
            `(?:\\[(?:("|')(?:\\\\.|(?!\\\\|\\1).)+\\1)\\])`, // string accessor
            `(?:\\[(?:${sc2Patterns.variableWithSigil})\\])`, // variable accessor
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
    bareVariableRegex.lastIndex = 0;
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

/**
 * Parse a Twine link.
 *
 * @param text Text to parse.
 * @param linkIndex Index in text where the link begins (zero-based).
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns The markup data about the link.
 */
function parseTwineLink(
    text: string,
    linkIndex: number,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): LinkMarkupData {
    const markupData = parseSquareBracketedMarkup(text, linkIndex);
    const error = markupData.error;
    if (
        error === undefined &&
        markupData.isLink &&
        markupData.link !== undefined
    ) {
        parsePassageReference(
            markupData.link.text,
            markupData.link.at + textIndex,
            state,
            sugarcubeState
        );

        if (markupData.text !== undefined) {
            capturePreSemanticTokenFor(
                markupData.text.text,
                markupData.text.at + textIndex,
                ETokenType.string,
                [],
                sugarcubeState
            );
        }
        if (markupData.delim !== undefined) {
            capturePreSemanticTokenFor(
                markupData.delim.text,
                markupData.delim.at + textIndex,
                ETokenType.keyword,
                [],
                sugarcubeState
            );
        }
        if (markupData.setter !== undefined) {
            createVariableAndPropertyReferences(
                tokenizeTwineScriptExpression(
                    markupData.setter.text,
                    markupData.setter.at + textIndex,
                    state.textDocument,
                    sugarcubeState
                ),
                state
            );
        }
    } else if (error !== undefined) {
        logErrorFor(error.text, error.at, error.message, state);
    }

    return markupData;
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
        const markupData = parseTwineLink(
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

const noWikiRegex = new RegExp(sc2Patterns.noWikiBlock, "gi");

/**
 * Remove nowiki text from a subsection.
 *
 * (Strictly speaking, we also remove inline code markup, too.)
 *
 * Examples: `"""remove"""`, `<nowiki>remove</nowiki>`, `{{{remove}}}`
 *
 * @param subsection Subsection to remove nowiki text from.
 * @returns The subsection with nowiki text blanked out.
 */
function removeNoWikiText(subsection: string): string {
    noWikiRegex.lastIndex = 0;
    return eraseMatches(subsection, noWikiRegex);
}

const macroRegex = new RegExp(sc2Patterns.fullMacro, "gm");
const scriptStyleBlockRegex = new RegExp(sc2Patterns.scriptStyleBlock, "gm");

interface macroLocationInfo {
    name: string;
    fullText: string;
    at: number;
    id: number; // To disambiguate macros with the same name
}

/**
 * Parse the arguments to a macro.
 *
 * @param args Unparsed arguments.
 * @param argsIndex Index of the unparsed arguments in the larger document (zero-based).
 * @param macroInfo Information about the macro the arguments belong to, if known.
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
function parseMacroArgs(
    args: string | undefined,
    argsIndex: number,
    macroInfo: MacroInfo | undefined,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
): void {
    const argumentTokens =
        args !== undefined ? tokenizeMacroArguments(args, argsIndex) : [];
    for (const arg of argumentTokens) {
        if (arg.type === MacroParse.Item.Error) {
            logErrorFor(
                arg.text,
                arg.at,
                arg.message || "Unknown macro argument parsing error",
                state
            );
        } else if (arg.type === MacroParse.Item.Bareword) {
            createVariableAndPropertyReferences(
                tokenizeTwineScriptExpression(
                    arg.text,
                    arg.at,
                    state.textDocument,
                    sugarcubeState
                ),
                state
            );
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
            const markup = parseTwineLink(
                arg.text,
                0,
                arg.at,
                state,
                sugarcubeState
            );
            // No setters allowed
            if (markup.setter !== undefined) {
                logErrorFor(
                    `[${markup.setter.text}]`,
                    arg.at + markup.setter.at - 1,
                    "Links in macro arguments can't have a setter",
                    state
                );
            }
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

    // Remove all script/style tag blocks
    scriptStyleBlockRegex.lastIndex = 0;
    const cleanedPassageText = eraseMatches(passageText, scriptStyleBlockRegex);

    let macroId = 0;
    const unclosedMacros: macroLocationInfo[] = [];
    const macroChildCount: Record<number, Record<string, number>> = {}; // Map of parent macro ID to child name + count
    macroRegex.lastIndex = 0;
    for (const m of cleanedPassageText.matchAll(macroRegex)) {
        const macroIndex = m.index + 2; // Index of the start of the macro (inside the <<)

        // macroName: name of the macro
        // macroBody: the body of the macro (e.g. its arguments)
        // macroEnd: "end" or "/" at the start of the macro (e.g. <</if>>)
        // macroSelfClose: "/" at the end of the macro
        const {
            macroName,
            preMacroBodySpace,
            macroBody,
            macroEnd,
            macroSelfClose,
        } = m.groups as {
            [key: string]: string;
        };

        const macroBodyIndex =
            macroIndex +
            (macroEnd || "").length +
            macroName.length +
            preMacroBodySpace.length;

        let isOpenMacro = true, // whether the macro is an opening one (i.e. not a close or self-closing one)
            endVariant = false, // whether it's one that starts with "end"
            name = macroName,
            isSelfClosedMacro = false;

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
        if (isOpenMacro || isSelfClosedMacro) {
            state.callbacks.onSymbolReference(
                createSymbolFor(
                    name,
                    textIndex + macroIndex,
                    macroInfo !== undefined
                        ? OSugarCubeSymbolKind.BuiltInMacro
                        : OSugarCubeSymbolKind.CustomMacro,
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
            (macroEnd || "") + macroName,
            textIndex + macroIndex,
            ETokenType.function,
            deprecated ? [ETokenModifier.deprecated] : [],
            sugarcubeState
        );

        if (macroInfo !== undefined) {
            // Check for macros that have been removed or aren't yet available
            const storyFormatVersion = state.storyFormat?.formatVersion;
            if (
                storyFormatVersion !== undefined &&
                (isOpenMacro || isSelfClosedMacro)
            ) {
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
                        id: macroId,
                    });
                } else {
                    let openingMacroFound = false;
                    for (let i = unclosedMacros.length - 1; i >= 0; --i) {
                        if (unclosedMacros[i].name === macroInfo.name) {
                            delete macroChildCount[unclosedMacros[i].id];
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
                const parentMacroInfo = unclosedMacros
                    .reverse()
                    .find((info) => parentNames.includes(info.name));
                if (parentMacroInfo !== undefined) {
                    // Record the number of times the child has appeared if there's a limit
                    const macroParent = macroInfo.parents.find(
                        (p) =>
                            MacroParent.is(p) && p.name === parentMacroInfo.name
                    );
                    if (MacroParent.is(macroParent)) {
                        if (macroChildCount[parentMacroInfo.id] === undefined) {
                            macroChildCount[parentMacroInfo.id] = {};
                        }
                        macroChildCount[parentMacroInfo.id][macroInfo.name] =
                            (macroChildCount[parentMacroInfo.id][
                                macroInfo.name
                            ] || 0) + 1;
                        // Make sure we don't have too many of the same kind of child macro
                        if (
                            macroChildCount[parentMacroInfo.id][
                                macroInfo.name
                            ] > macroParent.max
                        ) {
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
        parseMacroArgs(
            macroBody,
            macroBodyIndex + textIndex,
            macroInfo,
            state,
            sugarcubeState
        );

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

    const tags = state.currentPassage?.tags || [];
    const tagNames = tags.map((t) => t.contents);
    const mediaTags = tags.filter((x) => mediaPassageTags.has(x.contents));
    if (tagNames.includes("script")) {
        // We'll tokenize the contents, but not capture variable and
        // property references
        tokenizeJSExpression(
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
                (state.currentPassage?.name.contents || "placeholder").replace(
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

    passageText = removeNoWikiText(passageText);

    passageText = parseMacros(passageText, textIndex, state, sugarcubeState);

    passageText = parseAndRemoveTwineLinks(
        passageText,
        textIndex,
        state,
        sugarcubeState
    );

    parseBareVariables(passageText, textIndex, state, sugarcubeState);

    // Submit semantic tokens in document order
    // (taking advantage of object own key enumeration order)
    for (const t of Object.values(sugarcubeState.passageTokens)) {
        logSemanticTokenFor(t.text, t.at, t.type, t.modifiers, state);
    }
}
