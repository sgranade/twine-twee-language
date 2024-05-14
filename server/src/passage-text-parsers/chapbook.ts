import { TextDocument } from "vscode-languageserver-textdocument";
import {
    ParsingState,
    logErrorFor,
    logTokenFor,
    logWarningFor,
} from "../parser";
import { ETokenModifier, ETokenType } from "../tokens";
import { removeAndCountPadding } from "../utilities";
import { PassageTextParser } from "./passage-text-parser";

const varsSepPattern = /^--(\r?\n|$)/m;
const conditionPattern = /((\((.+?)\)?)\s*)([^)]*)$/;
const modifierPattern = /^([ \t]*)\[([^[].+[^\]])\](\s*?)(?:\r?\n|$)/gm;
const lineExtractionPattern = /^(\s*?)\b(.*)$/gm;

/**
 * Type of Chapbook modifier
 */
enum ModifierType {
    Javascript,
    Css,
    Note,
    Other,
}

/**
 * Chapbook-specific parsing state information.
 */
interface ChapbookParsingState {
    /**
     * Type of modifier affecting a text block.
     */
    modifierType: ModifierType;
}

/**
 * Get passage text parser for the Chapbook story format.
 *
 * @param formatVersion Specific Chapbook version.
 * @returns Parser, or undefined if none is available.
 */
export function getChapbookParser(
    formatVersion: string | undefined
): PassageTextParser | undefined {
    return {
        id: "chapbook-any",
        parsePassageText: parsePassageText,
    };
}

/**
 * Parse a text subsection of a Chapbook passage text section.
 *
 * The subsection may be controlled by a modifier, whose effects
 * are captured in the Chapbook state.
 *
 * @param subsection Subsection of the passage text section.
 * @param subsectionIndex Index in the document where the subsection begins (zero-based).
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseTextSubsection(
    subsection: string,
    subsectionIndex: number,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    if (chapbookState.modifierType === ModifierType.Javascript) {
        // TODO tokenize javascript
    } else if (chapbookState.modifierType === ModifierType.Css) {
        state.callbacks.onEmbeddedDocument({
            document: TextDocument.create(
                "stylesheet",
                "css",
                state.textDocument.version,
                subsection
            ),
            offset: subsectionIndex,
        });
    } else if (chapbookState.modifierType === ModifierType.Note) {
        logTokenFor(subsection, subsectionIndex, ETokenType.comment, [], state);
    } else {
        // TODO parse the actual contents
    }
}

/**
 * Parse the contents of a Chapbook modifier.
 *
 * @param modifier Full modifier text without the brackets ([]).
 * @param modifierIndex Index in the document where the modifier text begins (zero-based).
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseModifier(
    modifier: string,
    modifierIndex: number,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    let firstToken = true;
    let remainingModifier = modifier;
    let padLeft: number;
    let tokenIndex = modifierIndex;

    while (remainingModifier) {
        [remainingModifier, padLeft] = removeAndCountPadding(remainingModifier);
        if (remainingModifier === "") {
            break;
        }
        tokenIndex += padLeft;
        const token = remainingModifier.split(/\s/, 1)[0];
        if (firstToken) {
            // The first token can set the following text block's state
            switch (token.toLowerCase()) {
                case "javascript":
                    chapbookState.modifierType = ModifierType.Javascript;
                    break;

                case "css":
                    chapbookState.modifierType = ModifierType.Css;
                    break;

                case "note":
                case "note to myself":
                case "n.b.":
                case "fixme":
                case "todo":
                    chapbookState.modifierType = ModifierType.Note;
                    break;
            }

            // Tokenize the first token as a function, unless the modifier is a note
            logTokenFor(
                token,
                tokenIndex,
                chapbookState.modifierType == ModifierType.Note
                    ? ETokenType.comment
                    : ETokenType.function,
                [],
                state
            );

            firstToken = false;
        } else {
            // All other components of the modifier get treated as parameters
            logTokenFor(token, tokenIndex, ETokenType.parameter, [], state);
        }

        remainingModifier = remainingModifier.substring(token.length);
        tokenIndex += token.length;
    }
}

/**
 * Parse the text section of a Chapbook passage.
 *
 * @param section The text section.
 * @param sectionIndex Index in the document where the text section begins (zero-based).
 * @param state Parsing state.
 */
function parseTextSection(
    section: string,
    sectionIndex: number,
    state: ParsingState
): void {
    // Go through the text modifier block by modifier block
    modifierPattern.lastIndex = 0;
    let previousModifierEndIndex = 0;
    const chapbookState: ChapbookParsingState = {
        modifierType: ModifierType.Other,
    };
    for (const m of section.matchAll(modifierPattern)) {
        // Parse the text from just after the previous modifier to just before the current one
        parseTextSubsection(
            section.slice(previousModifierEndIndex, m.index),
            sectionIndex + previousModifierEndIndex,
            state,
            chapbookState
        );

        // Reset the modifier type
        chapbookState.modifierType = ModifierType.Other;

        // Check for spaces before/after the modifier, which causes Chapbook to ignore them
        if (m[1] !== "") {
            logErrorFor(
                m[1],
                sectionIndex + m.index,
                "Modifiers can't have spaces before them",
                state
            );
        }
        if (m[3] !== "") {
            // The +2 in the index is for the modifier's two brackets ([])
            logErrorFor(
                m[3],
                sectionIndex + m.index + 2 + m[1].length + m[2].length,
                "Modifiers can't have spaces after them",
                state
            );
        }

        // Modifiers are separated by ; not inside a double quote
        // (Single quote isn't allowed, as "con't" is a modifier)
        const rawModifiers = m[2];
        // The + 1 is to account for the modifier's opening brace ([)
        const rawModifiersIndex = m.index + m[1].length + 1;
        let modifier = "";
        let i = 0;
        for (; i < rawModifiers.length; ++i) {
            if (rawModifiers[i] === '"') {
                // Scan forward to the matching quote mark
                modifier += '"';
                for (i = i + 1; i < rawModifiers.length; i++) {
                    modifier += rawModifiers[i];

                    if (
                        rawModifiers[i] === '"' &&
                        rawModifiers[i - 1] !== "\\"
                    ) {
                        break;
                    }
                }
            } else if (rawModifiers[i] === ";") {
                parseModifier(
                    modifier,
                    sectionIndex + rawModifiersIndex + i - modifier.length,
                    state,
                    chapbookState
                );
                modifier = "";
            } else {
                modifier += rawModifiers[i];
            }
        }
        if (modifier !== "") {
            parseModifier(
                modifier,
                sectionIndex + rawModifiersIndex + i - modifier.length,
                state,
                chapbookState
            );
        }

        previousModifierEndIndex = m.index + m[0].length;
        // Skip the end line terminator(s)
        if (section[previousModifierEndIndex] === "\n")
            previousModifierEndIndex++;
        else if (
            section[previousModifierEndIndex] === "\r" &&
            section[previousModifierEndIndex + 1] === "\n"
        ) {
            previousModifierEndIndex += 2;
        }
    }

    // Parse the text remaining after the final modifier
    parseTextSubsection(
        section.slice(previousModifierEndIndex),
        sectionIndex + previousModifierEndIndex,
        state,
        chapbookState
    );
}

/**
 * Parse the vars section of a Chapbook passage.
 *
 * @param section The vars section.
 * @param sectionIndex Index in the document where the vars section begins (zero-based).
 * @param state Parsing state.
 */
function parseVarsSection(
    section: string,
    sectionIndex: number,
    state: ParsingState
): void {
    // Parse line by line
    lineExtractionPattern.lastIndex = 0;
    for (const m of section.matchAll(lineExtractionPattern)) {
        // Matches are [line (0), leading whitespace (1), contents (2)]
        // Skip blank lines
        if (m[0].trim() === "") continue;

        const colonIndex = m[2].indexOf(":");
        // If the colon is missing, the entire line will be ignored
        if (colonIndex === -1) {
            logWarningFor(
                m[0],
                sectionIndex + m.index,
                "Missing colon; this line will be ignored",
                state
            );
            continue;
        }
        let name = m[2].slice(0, colonIndex).trimEnd();
        const nameIndex = m.index + m[1].length;
        // eslint-disable-next-line prefer-const
        let [value, valueIndex] = removeAndCountPadding(
            m[1].slice(colonIndex + 1)
        );
        valueIndex += m.index + colonIndex;

        // Check for a condition
        const conditionMatch = conditionPattern.exec(name);
        if (conditionMatch !== null) {
            // Matches are [whole thing (0), (condition)\s* (1), (condition) (2), condition (3), ignored text (4)]
            name = name.slice(0, conditionMatch.index).trimEnd();
            const conditionMatchIndex = nameIndex + conditionMatch.index;

            // Make sure the condition ends in a closing parenthesis
            if (conditionMatch[2].slice(-1) !== ")") {
                logErrorFor(
                    "",
                    sectionIndex +
                        conditionMatchIndex +
                        conditionMatch[0].length,
                    "Missing a close parenthesis",
                    state
                );
            } else {
                // TODO tokenize the condition as JS

                // Check for ignored text
                if (conditionMatch[4] !== "") {
                    logWarningFor(
                        conditionMatch[4].trimEnd(),
                        sectionIndex +
                            conditionMatchIndex +
                            conditionMatch[1].length,
                        "This will be ignored",
                        state
                    );
                }
            }
        }

        // Make sure the name has no spaces and is a legal JS name
        const spaceMatch = /\s+/.exec(name);
        if (spaceMatch !== null) {
            logErrorFor(
                spaceMatch[0],
                sectionIndex + nameIndex + spaceMatch.index,
                "Variable names can't have spaces",
                state
            );
            name = name.slice(0, spaceMatch.index);
        }
        if (!/^[A-Za-z$_]/u.test(name)) {
            logErrorFor(
                name[0],
                sectionIndex + nameIndex,
                "Variable names must start with a letter, $, or _",
                state
            );
        }
        for (const badCharMatch of name
            .slice(1)
            .matchAll(/[^A-Za-z0-9$_.]/gu)) {
            logErrorFor(
                badCharMatch[0],
                sectionIndex + nameIndex + 1 + badCharMatch.index,
                "Must be a letter, digit, $, or _",
                state
            );
        }

        logTokenFor(
            name,
            sectionIndex + nameIndex,
            ETokenType.variable,
            [ETokenModifier.modification],
            state
        );

        // TODO call back on variable

        // Tokenize? the value as a JS expression
    }
}

/**
 * Parse the text of a Chapbook passage.
 *
 * @param passageText Passage text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 */
function parsePassageText(
    passageText: string,
    textIndex: number,
    state: ParsingState
): void {
    let vars,
        content,
        contentIndex = 0;
    const varSeparatorMatch = varsSepPattern.exec(passageText);
    if (varSeparatorMatch !== null) {
        vars = passageText.slice(0, varSeparatorMatch.index);
        contentIndex = varSeparatorMatch.index + varSeparatorMatch[0].length;
        content = passageText.slice(contentIndex);
        parseVarsSection(vars, textIndex + 0, state);
    } else {
        content = passageText;
    }
    parseTextSection(content, textIndex + contentIndex, state);
}
