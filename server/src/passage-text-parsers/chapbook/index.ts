import { TextDocument } from "vscode-languageserver-textdocument";
import {
    ParsingState,
    logErrorFor,
    logTokenFor,
    logWarningFor,
    parseLinks,
} from "../../parser";
import { ETokenModifier, ETokenType } from "../../tokens";
import { removeAndCountPadding, skipSpaces } from "../../utilities";
import {
    PassageTextParser,
    PassageTextParsingState,
    capturePreTokenFor,
} from "..";
import { InsertTokens, all as allInserts } from "./inserts";

const varsSepPattern = /^--(\r?\n|$)/m;
const conditionPattern = /((\((.+?)\)?)\s*)([^)]*)$/;
const modifierPattern = /^([ \t]*)\[([^[].+[^\]])\](\s*?)(?:\r?\n|$)/gm;
const lineExtractionPattern = /^(\s*?)\b(.*)$/gm;

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
export interface ChapbookParsingState extends PassageTextParsingState {
    /**
     * Type of modifier affecting a text block.
     */
    modifierType: ModifierType;
}

const varInsertPattern = /^({\s*)(\S+)\s*}$/;

/**
 * Parse the contents of an insert.
 *
 * @param tokens Tokenized insert information.
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseInsertContents(
    tokens: InsertTokens,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    const insert = allInserts().find((i) => i.match.test(tokens.name.text));
    if (insert === undefined) {
        logWarningFor(
            tokens.name.text,
            tokens.name.at,
            `Insert "${tokens.name.text}" not recognized`,
            state
        );
        return;
    }

    // Check for required and unknown arguments

    // First up, first argument
    if (insert.arguments.firstArgument && tokens.firstArgument === undefined) {
        logErrorFor(
            tokens.name.text,
            tokens.name.at,
            `Insert "${insert.name}" requires a first argument`,
            state
        );
    } else if (
        !insert.arguments.firstArgument &&
        tokens.firstArgument !== undefined
    ) {
        logWarningFor(
            tokens.firstArgument.text,
            tokens.firstArgument.at,
            `Insert "${insert.name}" will ignore this first argument`,
            state
        );
    }

    // Second up, properties
    const seenProperties: Set<string> = new Set();
    for (const [propName] of tokens.props) {
        if (propName.text in insert.arguments.requiredProps) {
            seenProperties.add(propName.text);
        } else if (!(propName.text in insert.arguments.optionalProps)) {
            logWarningFor(
                propName.text,
                propName.at,
                `Insert "${insert.name}" will ignore this property`,
                state
            );
        }
    }
    const unseenProperties = Object.keys(insert.arguments.requiredProps).filter(
        (k) => !seenProperties.has(k)
    );
    if (unseenProperties.length > 0) {
        logErrorFor(
            tokens.name.text,
            tokens.name.at,
            `Insert "${insert.name}" missing expected properties: ${unseenProperties.join(", ")}`,
            state
        );
    }

    // Third up, whatever additional checks the insert wants to do
    insert.parse(tokens, state, chapbookState);
}

/**
 * Parse a Chapbook insert.
 *
 * @param insert Text of the insert, including the {}.
 * @param insertIndex Index in the document where the insert begins (zero-based).
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseInsert(
    insert: string,
    insertIndex: number,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    // A single word insert is a variable
    const m = varInsertPattern.exec(insert);
    if (m !== null) {
        const invocation = m[2];
        const invocationIndex = m[1].length;
        capturePreTokenFor(
            invocation,
            insertIndex + invocationIndex,
            ETokenType.variable,
            [],
            chapbookState
        );

        // Variables only allow array dereferencing at the end
        const bracketMatch = /(\[.+\])\S+/.exec(invocation);
        if (bracketMatch !== null) {
            logErrorFor(
                bracketMatch[1],
                insertIndex + invocationIndex + bracketMatch.index,
                "Array dereferencing can only be at the end (that is, myVar[2] is okay but myVar[2].color isn't)",
                state
            );
        }

        // TODO index variable reference

        return;
    }

    // Functional inserts follow the form: {function name: arg, property: value }

    insertIndex++; // To swallow the opening curly brace
    const commaIndex = insert.indexOf(",");
    // Remove the {} when slicing
    const functionSection = insert.slice(
        1,
        commaIndex !== -1 ? commaIndex : -1
    );
    const propertySection = insert.slice(
        commaIndex !== -1 ? commaIndex + 1 : -1,
        insert.length - 1
    );
    let functionName = functionSection,
        argument = "";
    let functionIndex = 0,
        argumentIndex = 0;
    const colonIndex = functionSection.indexOf(":");
    if (colonIndex !== -1) {
        argumentIndex = colonIndex + 1;
        argument = functionName.slice(argumentIndex);
        functionName = functionName.slice(0, colonIndex);
    }

    // Handle the function name
    [functionName, functionIndex] = skipSpaces(functionName, functionIndex);

    // Tokenized insert information
    // Note that the token's given locations are relative to the entire document
    // instead of being relative to the insert's index.
    const insertTokens: InsertTokens = {
        name: { text: functionName, at: insertIndex + functionIndex },
        firstArgument: undefined,
        props: [],
    };

    capturePreTokenFor(
        insertTokens.name.text,
        insertTokens.name.at,
        ETokenType.function,
        [],
        chapbookState
    );

    // Handle the first argument
    [argument, argumentIndex] = skipSpaces(argument, argumentIndex);
    if (argument !== "") {
        insertTokens.firstArgument = {
            text: argument,
            at: insertIndex + argumentIndex,
        };
    }
    // TODO tokenize args & look for variable references

    // Handle properties
    if (propertySection.trim()) {
        const propertySectionIndex = functionSection.length + 1; // + 1 for the comma
        // TODO ideally parse this as JS. In the meantime, tokenize things that
        // look like properties.
        let propertyIndex = 0; // Relative to propertySection
        while (propertyIndex < propertySection.length) {
            const colonIndex = propertySection.indexOf(":", propertyIndex);
            if (colonIndex === -1) break;

            const [currentProperty, leftPad] = removeAndCountPadding(
                propertySection.slice(propertyIndex, colonIndex)
            );
            const currentPropertyIndex = propertyIndex + leftPad; // Relative to propertySection
            capturePreTokenFor(
                currentProperty,
                insertIndex + propertySectionIndex + currentPropertyIndex,
                ETokenType.property,
                [],
                chapbookState
            );

            // Properties can't have spaces bee tee dubs
            const spaceIndex = currentProperty.lastIndexOf(" ");
            if (spaceIndex !== -1) {
                logErrorFor(
                    currentProperty,
                    insertIndex + propertySectionIndex + currentPropertyIndex,
                    "Properties can't have spaces",
                    state
                );
            }

            // Scan forward to look for a comma that's not in a string,
            // indicating another property
            let inString = "";
            const currentValueIndex = colonIndex + 1; // Relative to propertySection
            let currentValueEndIndex = currentValueIndex;
            let c = "";
            for (
                ;
                currentValueEndIndex < propertySection.length;
                ++currentValueEndIndex
            ) {
                c = propertySection[currentValueEndIndex];
                if (c === "," && inString === "") {
                    break;
                }

                if (inString && c === inString) {
                    inString = "";
                } else if (c === '"' || c === "'") {
                    inString = c;
                }
            }
            propertyIndex = currentValueEndIndex;
            // Skip the comma (if it exists)
            if (c === ",") propertyIndex++;

            // If the property is well formed, capture it to pass to invidual inserts
            if (spaceIndex === -1) {
                const [currentValue, leftPad] = removeAndCountPadding(
                    propertySection.slice(
                        currentValueIndex,
                        currentValueEndIndex
                    )
                );
                // N.B. that currentPropertyIndex has taken a left pad into account,
                // while currentValueIndex hasn't
                insertTokens.props.push([
                    {
                        text: currentProperty,
                        at:
                            insertIndex +
                            propertySectionIndex +
                            currentPropertyIndex,
                    },
                    {
                        text: currentValue,
                        at:
                            insertIndex +
                            propertySectionIndex +
                            currentValueIndex +
                            leftPad,
                    },
                ]);
            }
        }
    }

    // Parse the insert contents
    parseInsertContents(insertTokens, state, chapbookState);
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
        // Semantic tokens have to be submitted in document order,
        // but we're going to generate them out of order. We'll
        // capture them and then later submit them in the proper order.
        chapbookState.textSubsectionTokens = {};

        // Parse Twine links first
        // The function replaces the link text with blank spaces so, if any include
        // curly braces, they don't get parsed as inserts.
        subsection = parseLinks(
            subsection,
            subsectionIndex,
            state,
            chapbookState
        );

        // Parse inserts
        // Parsing code taken from `render()` in `render-insert.ts` from Chapbook

        // startText is the index of the text before the opening curly bracket;
        // startCurly is the index of the bracket.

        let startText = 0;
        let startCurly = subsection.indexOf("{");

        if (startCurly !== -1) {
            // Scan forward until we reach:
            // -   another '{', indicating that the original '{' isn't the start of an
            //     insert
            // -   a single or double quote, indicating the start of a string value
            // -   a '}' that isn't inside a string, indicating the end of a possible
            //     insert

            let inString = false;
            let stringDelimiter;

            for (let i = startCurly + 1; i < subsection.length; i++) {
                switch (subsection[i]) {
                    case "{":
                        startCurly = i;
                        inString = false;
                        break;

                    case "'":
                    case '"':
                        // Ignore backslashed quotes.

                        if (i > 0 && subsection[i - 1] !== "\\") {
                            // Toggle inString status as needed.
                            if (!inString) {
                                inString = true;
                                stringDelimiter = subsection[i];
                            } else if (
                                inString &&
                                stringDelimiter === subsection[i]
                            ) {
                                inString = false;
                            }
                        }
                        break;

                    case "}":
                        if (!inString) {
                            // Extract the raw insert text to parse
                            const insertSrc = subsection.substring(
                                startCurly,
                                i + 1
                            );
                            parseInsert(
                                insertSrc,
                                subsectionIndex + startCurly,
                                state,
                                chapbookState
                            );

                            // Advance start variables for the next match.
                            startText = i + 1;
                            startCurly = subsection.indexOf("{", startText);

                            if (startCurly === -1) {
                                // There are no more open curly brackets left to examine.
                                // Short-circuit the for loop to bring it to an end.

                                i = subsection.length;
                            }
                        }
                        break;
                }
            }
        }

        // TODO TOKENIZE NODES/LEAFS

        // Submit semantic tokens in document order
        // (taking advantage of object own key enumeration order)
        for (const t of Object.values(chapbookState.textSubsectionTokens)) {
            logTokenFor(t.text, t.at, t.type, t.modifiers, state);
        }
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
    let tokenIndex = modifierIndex;

    while (remainingModifier) {
        [remainingModifier, tokenIndex] = skipSpaces(
            remainingModifier,
            tokenIndex
        );
        if (remainingModifier === "") {
            break;
        }
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
        textSubsectionTokens: {},
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
        let [, valueIndex] = removeAndCountPadding(m[1].slice(colonIndex + 1));
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

        // TODO Tokenize? the value as a JS expression
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
