import { StoryFormatParsingState, capturePreTokenFor } from "..";
import {
    ParsingState,
    logWarningFor,
    logErrorFor,
    logSemanticTokenFor,
    parseLinks,
    parsePassageReference,
    createSymbolFor,
    createLocationFor,
    parseHtml,
} from "../../parser";
import { ETokenType, ETokenModifier } from "../../tokens";
import {
    skipSpaces,
    removeAndCountPadding,
    extractToMatchingDelimiter,
    versionCompare,
} from "../../utilities";
import {
    InsertTokens,
    all as allInserts,
    Token,
    ArgumentRequirement,
    ValueType,
    InsertProperty,
} from "./inserts";
import { all as allModifiers, ModifierInfo } from "./modifiers";
import { parseJSExpression } from "../../js-parser";
import { ProjectIndex, Symbol, TwineSymbolKind } from "../../project-index";
import { EmbeddedDocument } from "../../embedded-languages";

const varsSepPattern = /^--(\r?\n|$)/m;
const conditionPattern = /((\((.+?)\)?)\s*)([^)]*)$/;
const modifierPattern = /^([ \t]*)\[([^[].+[^\]])\](\s*?)(?:\r?\n|$)/gm;
const lineExtractionPattern = /^([ \t]*?)\b(.*)$/gm;

/**
 * A Chapbook function such as an insert or modifier.
 */
export interface ChapbookFunctionInfo {
    /**
     * Regular expression that matches invocations of this function.
     */
    match: RegExp;
    /**
     * Function's syntax. Shown on hover; supports markdown.
     */
    syntax?: string;
    /**
     * Function's description. Shown on hover; supports markdown.
     */
    description?: string;
    /**
     * List of completions corresponding to this function.
     */
    completions?: string[];
    /**
     * Chapbook version when this function became available.
     */
    since?: string;
    /**
     * Chapbook version when this function became deprecated.
     */
    deprecated?: string;
    /**
     * Chapbook version when this function was removed.
     */
    removed?: string;
}
export namespace ChapbookFunctionInfo {
    /**
     * Type guard for ChapbookSymbol.
     */
    export function is(val: any): val is ChapbookFunctionInfo {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as ChapbookFunctionInfo).match !== undefined;
    }
    /**
     * Is a function available in a given Chapbook version?
     *
     * @param info Function information.
     * @param version Chapbook version.
     * @returns True if the function is available in the Chapbook version; false otherwise.
     */
    export function exists(
        info: ChapbookFunctionInfo,
        version: string
    ): boolean {
        if (info.since === undefined) return true;
        if (info.removed === undefined)
            return versionCompare(version, info.since) >= 0;
        return (
            versionCompare(version, info.since) >= 0 &&
            versionCompare(version, info.removed) < 0
        );
    }
    /**
     * Is a function deprecated in a given Chapbook version?
     *
     * @param info Function information.
     * @param version Chapbook version.
     * @returns True if the function is deprecated in the Chapbook version; false otherwise.
     */
    export function isDeprecated(
        info: ChapbookFunctionInfo,
        version: string
    ): boolean {
        if (info.deprecated === undefined) return false;
        return versionCompare(version, info.deprecated) >= 0;
    }
}

/**
 * Kind of a Chapbook symbol.
 */
export const OChapbookSymbolKind = {
    BuiltInModifier: TwineSymbolKind._end + 1,
    BuiltInInsert: TwineSymbolKind._end + 2,
    CustomModifier: TwineSymbolKind._end + 3,
    CustomInsert: TwineSymbolKind._end + 4,
};
export type ChapbookSymbolKind =
    (typeof OChapbookSymbolKind)[keyof typeof OChapbookSymbolKind];

/**
 * A Chapbook symbol, which corresponds either to a modifier or insert.
 */
export interface ChapbookSymbol extends Symbol, ChapbookFunctionInfo {}
export namespace ChapbookSymbol {
    /**
     * Type guard for ChapbookSymbol.
     */
    export function is(val: any): val is ChapbookSymbol {
        if (typeof val !== "object" || Array.isArray(val) || val === null)
            return false;
        return (val as ChapbookSymbol).match !== undefined;
    }
}

/**
 * Type of Chapbook modifier.
 */
export enum ModifierKind {
    None,
    Javascript,
    Css,
    Note,
    Other,
}

/**
 * Chapbook-specific parsing state information.
 */
export interface ChapbookParsingState extends StoryFormatParsingState {
    /**
     * Type of modifier affecting a text block.
     */
    modifierKind: ModifierKind;
}

const varInsertPattern = /^({\s*)(\S+)\s*}$/;

/**
 * Get Chapbook-specific symbol definitions across all indexed documents.
 *
 * @param kind Kind of Chapbook symbol definitions to return.
 * @param index Project index.
 * @returns List of definitions.
 */
export function getChapbookDefinitions(
    kind: ChapbookSymbolKind,
    index: ProjectIndex
): ChapbookSymbol[] {
    const customSymbols: ChapbookSymbol[] = [];
    for (const uri of index.getIndexedUris()) {
        customSymbols.push(
            ...(index
                .getDefinitions(uri, kind)
                ?.filter<ChapbookSymbol>((x): x is ChapbookSymbol =>
                    ChapbookSymbol.is(x)
                ) || [])
        );
    }
    return customSymbols;
}

enum jsObjectType {
    str,
    regex,
    strArray,
}

/**
 * Extract a Javascript object property.
 *
 * The property should be in the form:
 *    - `propertyName: "string value"`
 *    - `propertyName: 'string value'`
 *    - `propertyName: /regex value/i` (flags optional)
 *    - `propertyName: ['value 1', 'value 2']`
 *
 * @param propertyName Name of the Javascript object property to extract.
 * @param expectedType Type of the property's value.
 * @param contents String containing the object properties.
 * @param contentsIndex Index in the document where the contents begin (zero-based).
 * @param state Parsing state.
 * @returns Tuple of the property value as raw text, its index into contents, and the parsed value, or undefined if not found.
 */
function extractJSObjectProperty(
    propertyName: string,
    expectedType: jsObjectType,
    contents: string,
    contentsIndex: number,
    state: ParsingState
): [string, number, string | RegExp | string[]] | undefined {
    const m = new RegExp(`(?<=({|,)\\s*)${propertyName}:\\s?`, "s").exec(
        contents
    );
    if (m === null) return undefined;

    let retVal: string | RegExp | string[] | undefined = undefined;

    let fullPropertyValue = "";
    const fullPropertyNdx = m.index + m[0].length;
    const firstChar = contents[fullPropertyNdx];

    // String
    if (
        expectedType === jsObjectType.str &&
        (firstChar === "'" || firstChar === '"')
    ) {
        const propertyValue = extractToMatchingDelimiter(
            contents,
            firstChar,
            firstChar,
            fullPropertyNdx + 1
        );
        if (propertyValue !== undefined) {
            fullPropertyValue = `${firstChar}${propertyValue}${firstChar}`;
            retVal = propertyValue;
        }
    }

    // Regex
    else if (expectedType === jsObjectType.regex && firstChar === "/") {
        const propertyValue = extractToMatchingDelimiter(
            contents,
            "/",
            "/",
            fullPropertyNdx + 1
        );
        if (propertyValue !== undefined) {
            // Regexes can have flags; capture and verify those
            const matchFlagsNdx =
                fullPropertyNdx + 1 + propertyValue.length + 1; // + 1s to skip the "/"s
            const endPattern = /,|}|\r?\n|$/g;
            endPattern.lastIndex = matchFlagsNdx;
            const endNdx = endPattern.exec(contents)?.index;
            let matchFlags = contents.slice(matchFlagsNdx, endNdx).trimEnd();
            if (/[^dgimsuvy]/.test(matchFlags)) {
                logErrorFor(
                    matchFlags,
                    matchFlagsNdx + contentsIndex,
                    "Regular expression flags can only be d, g, i, m, s, u, v, and y",
                    state
                );
                matchFlags = "";
            }
            try {
                retVal = new RegExp(propertyValue, matchFlags);
                fullPropertyValue = `/${propertyValue}/${matchFlags}`;
            } catch (e) {
                logErrorFor(
                    `/${propertyValue}/${matchFlags}`,
                    fullPropertyNdx + contentsIndex,
                    `Invalid regular expression: ${e}`,
                    state
                );
            }
        }
    }

    // String array
    else if (expectedType === jsObjectType.strArray && firstChar === "[") {
        const propertyValue = extractToMatchingDelimiter(
            contents,
            "[",
            "]",
            fullPropertyNdx + 1
        );
        if (propertyValue !== undefined) {
            // Extract the purported strings one at a time -- we can't use
            // JSON parsing since the strings may be single quoted
            const arr: string[] = [];
            let currentArrNdx = 0;
            const commaBracketPattern = / *([,\]]|$)/g;
            while (currentArrNdx < propertyValue.length) {
                // Find the next string and save it
                let m = /^ *(['"])/.exec(propertyValue.slice(currentArrNdx));
                if (m === null) break;
                const arrString = extractToMatchingDelimiter(
                    propertyValue,
                    m[1],
                    m[1],
                    currentArrNdx + m[0].length
                );
                if (arrString === undefined) break;
                arr.push(arrString);

                // See if we need to keep going
                currentArrNdx += m[0].length + arrString.length + 1; // + 1 to skip closing quote mark
                commaBracketPattern.lastIndex = currentArrNdx;
                m = commaBracketPattern.exec(propertyValue);
                currentArrNdx += m !== null ? m[0].length : 0;
                // If it's not found, or we found the end of the string or a closing bracket, stop
                if (m === null || m[1] === "" || m[1] === "]") break;
            }
            if (arr.length > 0) {
                retVal = arr;
                fullPropertyValue = contents.slice(
                    fullPropertyNdx,
                    currentArrNdx
                );
            }
        }
    }

    if (retVal !== undefined) {
        return [fullPropertyValue, fullPropertyNdx, retVal];
    }

    return undefined;
}

/**
 * Parse a custom insert or modifier defined in the Twine story.
 *
 * @param contents Contents of the custom insert or modifier.
 * @param contentsIndex Index in the document where the contents begin (zero-based).
 * @param symbolKind Kind of contents being parsed.
 * @param state Parsing state.
 */
function parseCustomInsertOrModifierDefinition(
    contents: string,
    contentsIndex: number,
    symbolKind: ChapbookSymbolKind,
    state: ParsingState
): void {
    // Extract the "match" property contents
    const matchPropertyInfo = extractJSObjectProperty(
        "match",
        jsObjectType.regex,
        contents,
        contentsIndex,
        state
    );
    if (matchPropertyInfo === undefined) return;
    const match = matchPropertyInfo[2] as RegExp;
    const matchIndex = matchPropertyInfo[1];

    // If there's a "name" property, use that as the symbol's contents;
    // otherwise, stick with the regex match contents.
    let name: string;
    const namePropertyInfo = extractJSObjectProperty(
        "name",
        jsObjectType.str,
        contents,
        contentsIndex,
        state
    );
    if (namePropertyInfo !== undefined) {
        name = namePropertyInfo[2] as string;
    } else {
        name = match.source;
    }

    // If there's a "description" property, capture that as a
    // description
    let description: string | undefined;
    const descriptionPropertyInfo = extractJSObjectProperty(
        "description",
        jsObjectType.str,
        contents,
        contentsIndex,
        state
    );
    if (descriptionPropertyInfo !== undefined) {
        description = descriptionPropertyInfo[2] as string;
    }

    // Similarly, if there's a "syntax" property, capture that
    let syntax: string | undefined;
    const syntaxPropertyInfo = extractJSObjectProperty(
        "syntax",
        jsObjectType.str,
        contents,
        contentsIndex,
        state
    );
    if (syntaxPropertyInfo !== undefined) {
        syntax = syntaxPropertyInfo[2] as string;
    }

    // And finally the "completions" property
    let completions: string[] | undefined;
    const completionsPropertyInfo = extractJSObjectProperty(
        "completions",
        jsObjectType.strArray,
        contents,
        contentsIndex,
        state
    );
    if (completionsPropertyInfo !== undefined) {
        completions = completionsPropertyInfo[2] as string[];
    }

    // Custom inserts must have a space in their match object
    if (
        symbolKind === OChapbookSymbolKind.CustomInsert &&
        match.source.indexOf(" ") === -1 &&
        match.source.indexOf("\\s") === -1
    ) {
        logErrorFor(
            match.source,
            matchIndex + 1 + contentsIndex, // + 1 to skip the leading "/"
            "Custom inserts must have a space in their match",
            state
        );
    }

    // Save the match as a Regex in the associated label
    const symbol: ChapbookSymbol = {
        contents: name,
        location: createLocationFor(
            match.source,
            matchIndex + 1 + contentsIndex, // + 1 to skip the leading "/"
            state
        ),
        kind: symbolKind,
        match: match,
    };
    if (description !== undefined) symbol.description = description;
    if (syntax !== undefined) symbol.syntax = syntax;
    if (completions !== undefined) symbol.completions = completions;
    state.callbacks.onSymbolDefinition(symbol);
}

/**
 * Parse the internals of an `engine.extend()` call.
 *
 * @param contents Contents of the `extend()` call.
 * @param contentsIndex Index in the document where the contents begin (zero-based).
 * @param state Parsing state.
 */
function parseEngineExtension(
    contents: string,
    contentsIndex: number,
    state: ParsingState
): void {
    // The contents should be ('version', function())
    // where the function adds the new insert or modifier
    if (contents[0] !== '"' && contents[0] !== "'") return;
    const version = extractToMatchingDelimiter(
        contents,
        contents[0],
        contents[0],
        1
    );
    if (version === undefined) return;

    // Make sure the story format meets the extension's required minimum version
    if (state.storyFormat?.formatVersion !== undefined) {
        const minVersion = version.split(".").map((n) => parseInt(n, 10));
        if (minVersion.includes(NaN)) {
            logErrorFor(
                version,
                contentsIndex + 1,
                "The extension's version must be a number like '2.0.0'",
                state
            );
            return;
        }

        const curVersion = state.storyFormat.formatVersion
            .split(".")
            .map((n) => parseInt(n, 10));

        const end = Math.min(minVersion.length, curVersion.length);
        for (let ndx = 0; ndx < end; ++ndx) {
            if (curVersion[ndx] > minVersion[ndx]) {
                logWarningFor(
                    version,
                    contentsIndex + 1,
                    `The current story format version is ${state.storyFormat.formatVersion}, so this extension will be ignored`,
                    state
                );
                return;
            } else if (curVersion[ndx] < minVersion[ndx]) break;
        }

        if (minVersion.length < curVersion.length) {
            logWarningFor(
                version,
                contentsIndex + 1,
                `The current story format version is ${state.storyFormat.formatVersion}, so this extension will be ignored`,
                state
            );
            return;
        }
    }

    // Look for new inserts or modifiers
    const engineTemplatePattern = /engine\.template\.([^\.]+)\.add\(/g;
    let m: RegExpExecArray | null;
    while ((m = engineTemplatePattern.exec(contents)) !== null) {
        const addedContents = extractToMatchingDelimiter(
            contents,
            "(",
            ")",
            engineTemplatePattern.lastIndex
        );
        if (addedContents === undefined) continue;

        let symbolKind: ChapbookSymbolKind | undefined;
        if (m[1] === "modifiers") {
            symbolKind = OChapbookSymbolKind.CustomModifier;
        } else if (m[1] === "inserts") {
            symbolKind = OChapbookSymbolKind.CustomInsert;
        }
        if (symbolKind !== undefined) {
            parseCustomInsertOrModifierDefinition(
                addedContents,
                contentsIndex + engineTemplatePattern.lastIndex,
                symbolKind,
                state
            );
        } else {
            logWarningFor(
                `engine.template.${m[1]}`,
                contentsIndex + m.index,
                "Unrecognized engine template function",
                state
            );
        }

        engineTemplatePattern.lastIndex += addedContents.length + 1;
    }
}

/**
 * Find and parse all calls to the Chapbook `engine.extend()` function.
 *
 * @param contents Contents to search for engine extensions.
 * @param contentsIndex Index of the contents in the document (zero-based).
 * @param state Parsing state.
 */
function findEngineExtensions(
    contents: string,
    contentsIndex: number,
    state: ParsingState
): void {
    let ndx = contents.indexOf("engine.extend(");
    if (ndx >= 0) {
        ndx += "engine.extend(".length;
        let extendContents = extractToMatchingDelimiter(
            contents,
            "(",
            ")",
            ndx
        );
        if (extendContents !== undefined) {
            [extendContents, ndx] = skipSpaces(extendContents, ndx);
            parseEngineExtension(extendContents, contentsIndex + ndx, state);
        }
    }
}

/**
 * Parse an argument to an insert (either 1st argument or property value).
 *
 * @param token Token for the insert argument.
 * @param argType Expected type of argument.
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseInsertArgument(
    token: Token | undefined,
    argType: ValueType | undefined,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    if (
        token !== undefined &&
        (token.text.startsWith("'") || token.text.startsWith("'"))
    ) {
        if (
            argType === ValueType.passage ||
            (argType === ValueType.urlOrPassage &&
                !/^\w+:\/\/\/?\w/i.test(token.text.slice(1, -1))) // Link regex taken from Chapbook, `renderLink()`, links.ts
        ) {
            // Capture the passage reference
            // For the passage's semantic token to show up, we've got to get rid of the
            // one that would overlap (and override) this one
            delete chapbookState.passageTokens[token.at];

            parsePassageReference(
                token.text.slice(1, -1),
                token.at + 1,
                state,
                chapbookState
            );
        }
    }
}

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
    // See if we match a built-in insert
    const insert = allInserts().find((i) => i.match.test(tokens.name.text));
    // Store a reference to the insert (either built-in or custom)
    state.callbacks.onSymbolReference(
        createSymbolFor(
            tokens.name.text,
            tokens.name.at,
            insert !== undefined
                ? OChapbookSymbolKind.BuiltInInsert
                : OChapbookSymbolKind.CustomInsert,
            state
        )
    );

    // Capture semantic tokens for the insert's info
    // We wait until here b/c the insert may be deprecated, which affects the insert name's semantic token
    const deprecated =
        state.storyFormat?.formatVersion !== undefined &&
        insert?.deprecated !== undefined &&
        versionCompare(state.storyFormat.formatVersion, insert.deprecated) <= 0;
    capturePreTokenFor(
        tokens.name.text,
        tokens.name.at,
        ETokenType.function,
        deprecated ? [ETokenModifier.deprecated] : [],
        chapbookState
    );
    for (const [propName, [propNameToken]] of Object.entries(tokens.props) as [
        string,
        [Token, Token],
    ][]) {
        capturePreTokenFor(
            propName,
            propNameToken.at,
            ETokenType.property,
            [],
            chapbookState
        );
    }

    // If the reference is to a possible custom insert, there's nothing else for us to do right now
    if (insert === undefined) return;

    // Check the insert's version against our story format version
    const formatVersion = state.storyFormat?.formatVersion;
    if (formatVersion !== undefined) {
        if (
            insert.since !== undefined &&
            versionCompare(formatVersion, insert.since) <= 0
        ) {
            logErrorFor(
                tokens.name.text,
                tokens.name.at,
                `Insert {${insert.name}} isn't available until Chapbook version ${insert.since} but your StoryFormat version is ${formatVersion}`,
                state
            );
        } else if (
            insert.removed !== undefined &&
            versionCompare(formatVersion, insert.removed) >= 0
        ) {
            logErrorFor(
                tokens.name.text,
                tokens.name.at,
                `Insert {${insert.name}} was removed in Chapbook version ${insert.removed} and your StoryFormat version is ${formatVersion}`,
                state
            );
        }
    }

    // Check for required and unknown arguments
    // First up, first argument
    if (
        insert.arguments.firstArgument.required ===
            ArgumentRequirement.required &&
        tokens.firstArgument === undefined
    ) {
        logErrorFor(
            tokens.name.text,
            tokens.name.at,
            `Insert "${insert.name}" requires a first argument`,
            state
        );
    } else if (
        insert.arguments.firstArgument.required ===
            ArgumentRequirement.ignored &&
        tokens.firstArgument !== undefined
    ) {
        logWarningFor(
            tokens.firstArgument.text,
            tokens.firstArgument.at,
            `Insert "${insert.name}" will ignore this first argument`,
            state
        );
    }

    parseInsertArgument(
        tokens.firstArgument,
        insert.arguments.firstArgument.type,
        state,
        chapbookState
    );

    // Second up, properties
    const seenProperties: Set<string> = new Set();
    for (const [propName, [propNameToken, propValueToken]] of Object.entries(
        tokens.props
    ) as [string, [Token, Token]][]) {
        let propInfo: string | InsertProperty | null | undefined =
            insert.arguments.requiredProps[propName];

        if (propInfo !== undefined) {
            seenProperties.add(propName);
        } else {
            propInfo = insert.arguments.optionalProps[propName];
            if (propInfo === undefined)
                logWarningFor(
                    propNameToken.text,
                    propNameToken.at,
                    `Insert "${insert.name}" will ignore this property`,
                    state
                );
        }

        if (InsertProperty.is(propInfo)) {
            parseInsertArgument(
                propValueToken,
                propInfo.type,
                state,
                chapbookState
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
        name: Token.create(functionName, insertIndex + functionIndex),
        firstArgument: undefined,
        props: {},
    };

    // Handle the first argument
    [argument, argumentIndex] = skipSpaces(argument, argumentIndex);
    if (argument !== "") {
        insertTokens.firstArgument = Token.create(
            argument,
            insertIndex + argumentIndex
        );
    }
    parseJSExpression(argument, insertIndex + argumentIndex, chapbookState);
    // TODO look for variable references

    // Handle properties
    if (propertySection.trim()) {
        const propertySectionIndex = functionSection.length + 1; // + 1 for the comma

        // Tokenize things that look like properties.
        let propertyIndex = 0; // Relative to propertySection
        while (propertyIndex < propertySection.length) {
            const colonIndex = propertySection.indexOf(":", propertyIndex);
            if (colonIndex === -1) break;

            const [currentProperty, leftPad] = removeAndCountPadding(
                propertySection.slice(propertyIndex, colonIndex)
            );
            const currentPropertyIndex = propertyIndex + leftPad; // Relative to propertySection

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
            let currentValue = "";
            let currentValueIndex = colonIndex + 1; // Relative to propertySection
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

            // If the property is well formed, capture it to pass to individual inserts
            if (spaceIndex === -1) {
                [currentValue, currentValueIndex] = skipSpaces(
                    propertySection.slice(
                        currentValueIndex,
                        currentValueEndIndex
                    ),
                    currentValueIndex
                );

                insertTokens.props[currentProperty] = [
                    Token.create(
                        currentProperty,
                        insertIndex +
                            propertySectionIndex +
                            currentPropertyIndex
                    ),
                    Token.create(
                        currentValue,
                        insertIndex + propertySectionIndex + currentValueIndex
                    ),
                ];

                // Parse the value as JavaScript
                parseJSExpression(
                    currentValue,
                    insertIndex + propertySectionIndex + currentValueIndex,
                    chapbookState
                );
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
    if (chapbookState.modifierKind === ModifierKind.Javascript) {
        findEngineExtensions(subsection, subsectionIndex, state);
        parseJSExpression(subsection, subsectionIndex, chapbookState);
    } else if (chapbookState.modifierKind === ModifierKind.Css) {
        state.callbacks.onEmbeddedDocument(
            EmbeddedDocument.create(
                "stylesheet",
                "css",
                subsection,
                subsectionIndex,
                state.textDocument
            )
        );
    } else if (chapbookState.modifierKind === ModifierKind.Note) {
        capturePreTokenFor(
            subsection,
            subsectionIndex,
            ETokenType.comment,
            [],
            chapbookState
        );
    } else {
        // Parse Twine links first
        // The function replaces the link text with blank spaces so, if any include
        // curly braces, they don't get parsed as inserts.
        subsection = parseLinks(
            subsection,
            subsectionIndex,
            state,
            chapbookState
        );

        // Parse specific HTML tags
        subsection = parseHtml(subsection, subsectionIndex, state);

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
    const modifiers = allModifiers();

    while (remainingModifier) {
        [remainingModifier, tokenIndex] = skipSpaces(
            remainingModifier,
            tokenIndex
        );
        if (remainingModifier === "") {
            break;
        }

        let modifier: ModifierInfo | undefined = undefined;

        // See if we're referencing a built-in modifier (only on the first token!)
        if (firstToken) {
            modifier = modifiers.find((i) => i.match.test(remainingModifier));
            // Store a reference to the insert (either built-in or custom)
            state.callbacks.onSymbolReference(
                createSymbolFor(
                    remainingModifier,
                    tokenIndex,
                    modifier !== undefined
                        ? OChapbookSymbolKind.BuiltInModifier
                        : OChapbookSymbolKind.CustomModifier,
                    state
                )
            );

            // If we recognize the modifier, check its version, and let it parse the contents,
            // which can set the text block state in chapbookState
            if (modifier !== undefined) {
                const formatVersion = state.storyFormat?.formatVersion;
                if (formatVersion !== undefined) {
                    if (
                        modifier.since !== undefined &&
                        versionCompare(formatVersion, modifier.since) <= 0
                    ) {
                        logErrorFor(
                            remainingModifier,
                            tokenIndex,
                            `Modifier [${modifier.name}] isn't available until Chapbook version ${modifier.since} but your StoryFormat version is ${formatVersion}`,
                            state
                        );
                    } else if (
                        modifier.removed !== undefined &&
                        versionCompare(formatVersion, modifier.removed) >= 0
                    ) {
                        logErrorFor(
                            remainingModifier,
                            tokenIndex,
                            `Modifier [${modifier.name}] was removed in Chapbook version ${modifier.removed} and your StoryFormat version is ${formatVersion}`,
                            state
                        );
                    }
                }

                // Handle modifier-specific parsing, which can set the text block state in chapbookState
                modifier.parse(remainingModifier, state, chapbookState);
            }
        }

        const token = remainingModifier.split(/\s/, 1)[0];
        if (firstToken) {
            // Tokenize the first token as a function, unless the modifier is a note.
            // Also capture whether or not the modifier is deprecated.
            const deprecated =
                state.storyFormat?.formatVersion !== undefined &&
                modifier?.deprecated !== undefined &&
                versionCompare(
                    state.storyFormat.formatVersion,
                    modifier.deprecated
                ) <= 0;
            capturePreTokenFor(
                token,
                tokenIndex,
                chapbookState.modifierKind == ModifierKind.Note
                    ? ETokenType.comment
                    : ETokenType.function,
                deprecated ? [ETokenModifier.deprecated] : [],
                chapbookState
            );

            firstToken = false;
        } else {
            // All other components of the modifier get treated as parameters
            capturePreTokenFor(
                token,
                tokenIndex,
                ETokenType.parameter,
                [],
                chapbookState
            );
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
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    // Go through the text modifier block by modifier block,
    // starting with no modifier
    chapbookState.modifierKind = ModifierKind.None;
    modifierPattern.lastIndex = 0;
    let previousModifierEndIndex = 0;

    for (const m of section.matchAll(modifierPattern)) {
        // Parse the text from just after the previous modifier to just before the current one
        parseTextSubsection(
            section.slice(previousModifierEndIndex, m.index),
            sectionIndex + previousModifierEndIndex,
            state,
            chapbookState
        );

        // Reset the modifier type
        chapbookState.modifierKind = ModifierKind.None;

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
    state: ParsingState,
    chapbookState: ChapbookParsingState
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

        // Handle the value
        let [value, valueIndex] = skipSpaces(
            m[2].slice(colonIndex + 1),
            m.index + m[1].length + colonIndex + 1
        );
        parseJSExpression(value, sectionIndex + valueIndex, chapbookState);

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
                parseJSExpression(
                    conditionMatch[3],
                    sectionIndex +
                        conditionMatchIndex +
                        conditionMatch[0].indexOf(conditionMatch[3]),
                    chapbookState
                );

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

        capturePreTokenFor(
            name,
            sectionIndex + nameIndex,
            ETokenType.variable,
            [ETokenModifier.modification],
            chapbookState
        );

        // TODO call back on variable
    }
}

interface chapbookPassageParts {
    vars?: string;
    content: string;
    contentIndex: number;
}

/**
 * Divide a Chapbook passage into the (optional) vars section and the text.
 *
 * @param passageText Full text of the passage.
 * @returns Information about the vars section, or undefined if there is no vars section.
 */
function divideChapbookPassage(passageText: string): chapbookPassageParts {
    const passageParts: chapbookPassageParts = {
        content: passageText,
        contentIndex: 0,
    };
    const varSeparatorMatch = varsSepPattern.exec(passageText);
    if (varSeparatorMatch !== null) {
        passageParts.vars = passageText.slice(0, varSeparatorMatch.index);
        passageParts.contentIndex =
            varSeparatorMatch.index + varSeparatorMatch[0].length;
        passageParts.content = passageParts.content.slice(
            passageParts.contentIndex
        );
    }
    return passageParts;
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
    if (!state.parsePassageContents) {
        // Even if we don't parse passage contents, look for calls to
        // `engine.extend()` so we can capture custom inserts and modifiers
        findEngineExtensions(passageText, textIndex, state);
        return;
    }

    const chapbookState: ChapbookParsingState = {
        modifierKind: ModifierKind.None,
        passageTokens: {},
    };

    const passageParts = divideChapbookPassage(passageText);
    if (passageParts.vars !== undefined) {
        parseVarsSection(
            passageParts.vars,
            textIndex + 0,
            state,
            chapbookState
        );
    }
    // Generate an embedded HTML document for the entire passage
    state.callbacks.onEmbeddedDocument(
        EmbeddedDocument.create(
            (state.currentPassage?.name.contents || "placeholder").replace(
                " ",
                "-"
            ),
            "html",
            passageParts.content,
            textIndex + passageParts.contentIndex,
            state.textDocument,
            true
        )
    );

    parseTextSection(
        passageParts.content,
        textIndex + passageParts.contentIndex,
        state,
        chapbookState
    );

    // Submit semantic tokens in document order
    // (taking advantage of object own key enumeration order)
    for (const t of Object.values(chapbookState.passageTokens)) {
        logSemanticTokenFor(t.text, t.at, t.type, t.modifiers, state);
    }
}
