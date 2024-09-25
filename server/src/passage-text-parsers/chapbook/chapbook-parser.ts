import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { Diagnostic, DiagnosticSeverity } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { StoryFormatParsingState, capturePreTokenFor } from "..";
import { EmbeddedDocument } from "../../embedded-languages";
import {
    JSPropertyLabel,
    parseJSExpressionStrict,
    tokenizeJSExpression,
} from "../../js-parser";
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
    ParseLevel,
} from "../../parser";
import { Label, ProjectIndex } from "../../project-index";
import { ETokenType, ETokenModifier } from "../../tokens";
import {
    skipSpaces,
    extractToMatchingDelimiter,
    versionCompare,
    createDiagnostic,
    hasOwnProperty,
    createDiagnosticFor,
} from "../../utilities";
import {
    InsertTokens,
    ModifierTokens,
    Token,
    all as allInserts,
} from "./inserts";
import { all as allModifiers } from "./modifiers";
import {
    ArgumentRequirement,
    ChapbookFunctionInfo,
    ChapbookSymbol,
    ChapbookSymbolKind,
    FirstArgument,
    InsertProperty,
    InsertPropertyRecord,
    OChapbookSymbolKind,
    ValueType,
} from "./types";

const varsSepPattern = /^--(\r?\n|$)/m;
const conditionPattern = /((\((.+?)\)?)\s*)([^)]*)$/;
const modifierPattern = /^([ \t]*)\[([^[].+[^\]])\](\s*?)(?:\r?\n|$)/gm;
const varsLineExtractionPattern = /^([ \t]*?)\b(.*)$/gm;
const varsLineVarOnlyExtractionPattern =
    /^(\s*)([A-Za-z$_][A-Za-z0-9$_.]*)?.*$/gmu;

/**
 * Built-in lookup values in Chapbook.
 */
export const lookupVariables: readonly string[] = [
    "browser.darkTheme",
    "browser.darkSystemTheme",
    "browser.height",
    "browser.online",
    "browser.width",
    "engine.version",
    "now.datestamp",
    "now.day",
    "now.hour",
    "now.minute",
    "now.month",
    "now.monthName",
    "now.second",
    "now.timestamp",
    "now.weekday",
    "now.weekdayName",
    "now.year",
    "passage.from",
    "passage.fromText",
    "passage.name",
    "passage.visits",
    "story.name",
];

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

/**
 * Create symbol references for parsed variables and properties.
 *
 * @param varsAndProps Tuple with separate lists of variables and properties.
 * @param state Parsing state.
 * @param isSet True if the variables and properties are being set (assigned to).
 */
function createVariableAndPropertyReferences(
    varsAndProps: [Label[], JSPropertyLabel[]],
    state: ParsingState,
    isSet: boolean = false
): void {
    const varKind = isSet
        ? OChapbookSymbolKind.VariableSet
        : OChapbookSymbolKind.Variable;
    for (const v of varsAndProps[0]) {
        state.callbacks.onSymbolReference({
            contents: v.contents,
            location: v.location,
            kind: varKind,
        });
    }
    const propKind = isSet
        ? OChapbookSymbolKind.PropertySet
        : OChapbookSymbolKind.Property;
    for (const p of varsAndProps[1]) {
        // If there's a scope, add it to the name, b/c we save properties in their
        // full object context (ex: `var.prop.subprop`).
        const contents =
            p.scope !== undefined ? `${p.scope}.${p.contents}` : p.contents;
        state.callbacks.onSymbolReference({
            contents: contents,
            location: p.location,
            kind: propKind,
        });
    }
}

const braceMatch = /[\({['"}]/g; // For an opening "{"
const bracketMatch = /[\({['"\]]/g; // For an opening "["
const parenMatch = /[\({['"\)]/g; // For a nopening "("

/**
 * Find the index after the closing delimeter for an opening {, [, (, ', or ".
 *
 * @param contents Contents to find the closing delimeter in.
 * @param startIndex Index in the contents where the opening delimeter begins.
 * @returns Index one after the closing delimeter, or undefined if not found
 */
function findClosingDelimeterIndex(
    contents: string,
    startIndex: number
): number | undefined {
    const c = contents[startIndex];

    // Strings are easy
    if (c === "'" || c === '"') {
        const str = extractToMatchingDelimiter(contents, c, c, startIndex + 1);
        if (str !== undefined) {
            return startIndex + str.length + 2;
        } else {
            return contents.length;
        }
    }

    // Brackets, braces, and parentheses require more finesse, as they can
    // contain additional brackets, braces, parens, or strings
    if (c === "{" || c === "[" || c === "(") {
        let re = braceMatch;
        let close = "}";
        if (c === "[") {
            re = bracketMatch;
            close = "]";
        } else if (c === "(") {
            re = parenMatch;
            close = ")";
        }
        re.lastIndex = startIndex + 1;
        let m = re.exec(contents);

        // Go until there's no match
        while (m !== null) {
            // If we found the closing bracket/brace, return the position of
            // the character after the closing bracket/brace
            if (m[0] === close) {
                return m.index + 1;
            }

            // Skip over the nested bracket, brace, or string and keep going
            const nextIndex = findClosingDelimeterIndex(contents, m.index);
            if (nextIndex === undefined) break;
            re.lastIndex = nextIndex;
            m = re.exec(contents);
        }
    }

    return contents.length;
}

/**
 * Given a position in text, scan backwards to find the start of a possible modifier or insert.
 *
 * @param text Text to scan.
 * @param startOffset Where to begin in the text.
 * @returns The index to the start of the possible modifier ("[") or insert ("{"), or undefined if not found.
 */
export function findStartOfModifierOrInsert(
    text: string,
    startOffset: number
): number | undefined {
    let start: number | undefined;

    for (let i = startOffset; i >= 0; --i) {
        // Don't go further back than the current line
        if (text[i] === "\n") break;
        // { marks a potential insert; [ at the start of a line is a modifier
        if (
            text[i] === "{" ||
            (text[i] === "[" && (i === 0 || text[i - 1] === "\n"))
        ) {
            start = i;
            break;
        }
    }

    return start;
}

/**
 * Find the end offset of a (possibly partial) insert given the start of that insert.
 *
 * @param text Text to extract the insert from.
 * @param startOffset Offset to the starting "{" of the insert.
 * @returns Offset to the end "}" (for complete inserts) or "\n" or end of the string (for partial inserts), or undefined if no end found.
 */
export function findEndOfPartialInsert(
    text: string,
    startOffset: number
): number | undefined {
    // Parsing code adapted from `render()` in `render-insert.ts` from Chapbook

    // Scan forward until we reach:
    // -   another '{', indicating that the original '{' isn't the start of an
    //     insert
    // -   a single or double quote, indicating the start of a string value
    // -   a '}' that isn't inside a string, indicating the end of a possible
    //     insert
    // -   the end of the line
    let inString = false;
    let stringDelimiter;

    for (let i = startOffset + 1; i < text.length; i++) {
        switch (text[i]) {
            case "{":
                // We're not in an insert -- bail out
                return undefined;

            case "\n":
                // Return this index as the end of the partial insert
                return i;

            case "'":
            case '"':
                // Ignore backslashed quotes.
                if (i > 0 && text[i - 1] !== "\\") {
                    // Toggle inString status as needed.
                    if (!inString) {
                        inString = true;
                        stringDelimiter = text[i];
                    } else if (inString && stringDelimiter === text[i]) {
                        inString = false;
                    }
                }
                break;

            case "}":
                if (!inString) {
                    return i;
                }
                break;
        }
    }

    return text.length;
}

/**
 * Find the end offset of a (possibly partial) modifier given the start of that modifier.
 *
 * @param text Text to extract the modifier from.
 * @param startOffset Offset to the starting "[" of the modifier.
 * @returns Offset to the end "]" (for complete modifiers) or "\n" or end of the string (for partial modifiers), or undefined if no end found.
 */
export function findEndOfPartialModifier(
    text: string,
    startOffset: number
): number | undefined {
    // Look for the end bracket or end of line
    const pattern = /]|\r?\n/gm;
    pattern.lastIndex = startOffset;
    const m = pattern.exec(text) || undefined;
    return m?.index;
}

/**
 * An insert's expected arguments and completion/placeholder information.
 */
interface FunctionArguments {
    /**
     * Is a first argument required?
     */
    firstArgument: {
        required: ArgumentRequirement;
        placeholder?: string;
        type?: ValueType;
    };
    /**
     * Properties that must be present, with their placeholder (string) or full optional info.
     */
    requiredProps: InsertPropertyRecord;
    /**
     * Properties that may be present, with their optional info.
     */
    optionalProps: InsertPropertyRecord;
}

/**
 * Parse information about a custom insert/modifier's arguments.
 *
 * @param argsNode Node in the AST containing the custom  argument object.
 * @param contentsIndex Index where the contents containing the node begin.
 * @param symbolKind Kind of contents being parsed.
 * @param state Parsing state.
 * @returns Parsed arguments, or undefined if they can't be parsed.
 */
function parseCustomFunctionArguments(
    argsNode: acorn.Node,
    contentsIndex: number,
    symbolKind: ChapbookSymbolKind,
    state: ParsingState
): FunctionArguments | undefined {
    let firstArgRequired: ArgumentRequirement | undefined;
    const args: FunctionArguments = {
        firstArgument: {
            // Required placeholder; we'll take the actual value from firstArgRequired variable
            required: ArgumentRequirement.ignored,
        },
        requiredProps: {},
        optionalProps: {},
    };

    acornWalk.fullAncestor(
        argsNode,
        (rawNode: acorn.Node, _: unknown, ancestors: acorn.Node[]) => {
            const node = rawNode as acorn.AnyNode;
            // We only care about object properties whose keys are plain identifiers
            if (node.type !== "Property" || node.key.type !== "Identifier")
                return;

            let errorNode: acorn.Node | undefined;
            let errorMessage = ""; // Placeholder
            let errorSeverity: DiagnosticSeverity = DiagnosticSeverity.Warning;

            // Handle the sub-properties of firstArgument, optionalProps, and requiredProps
            if (
                (node.value.type === "Literal" ||
                    node.value.type === "ObjectExpression") &&
                ancestors.length === 4
            ) {
                const parentPropNode = ancestors[
                    ancestors.length - 3
                ] as acorn.AnyNode;
                if (
                    parentPropNode.type !== "Property" ||
                    parentPropNode.key.type !== "Identifier"
                )
                    return;

                const parentProp = parentPropNode.key.name;

                // firstArgument parsing
                if (
                    parentProp === "firstArgument" &&
                    node.value.type === "Literal"
                ) {
                    // "required" property
                    if (node.key.name === "required") {
                        if (typeof node.value.value === "string") {
                            const requirement =
                                ArgumentRequirement[
                                    node.value
                                        .value as keyof typeof ArgumentRequirement
                                ];
                            if (requirement !== undefined) {
                                firstArgRequired = requirement;
                            } else {
                                errorNode = node.value;
                                errorMessage =
                                    "Must be one of " +
                                    Object.keys(ArgumentRequirement)
                                        .map((v) => "'" + v + "'")
                                        .join(", ") +
                                    ".";
                            }
                        } else if (typeof node.value.value === "boolean") {
                            firstArgRequired = node.value.value
                                ? ArgumentRequirement.required
                                : ArgumentRequirement.optional;
                        } else {
                            errorNode = node.value;
                            errorMessage = "Must be a string or a boolean";
                        }
                    }
                    // "placeholder" property
                    else if (node.key.name === "placeholder") {
                        if (typeof node.value.value === "string") {
                            args.firstArgument.placeholder = node.value.value;
                        } else {
                            errorNode = node.value;
                            errorMessage = "Must be a string";
                        }
                    }
                    // "type" property
                    else if (node.key.name === "type") {
                        const valueType =
                            typeof node.value.value === "string"
                                ? ValueType[
                                      node.value.value as keyof typeof ValueType
                                  ]
                                : undefined;
                        if (valueType === undefined) {
                            errorNode = node.value;
                            errorMessage =
                                "Must be one of " +
                                Object.keys(ValueType)
                                    .map((v) => "'" + v + "'")
                                    .join(", ") +
                                ".";
                        } else {
                            args.firstArgument.type = valueType;
                        }
                    } else {
                        errorNode = node.key;
                        errorMessage =
                            "Unrecognized property; must be 'required', 'placeholder', or 'type'";
                    }
                }
                // optionalProps/requiredProps parsing
                else if (
                    parentProp === "optionalProps" ||
                    parentProp === "requiredProps"
                ) {
                    if (symbolKind === OChapbookSymbolKind.CustomModifier) {
                        errorMessage = `${parentProp} are ignored for a custom modifier`;
                        errorNode = parentPropNode.key;
                    } else {
                        const props =
                            parentProp === "optionalProps"
                                ? args.optionalProps
                                : args.requiredProps;

                        // Literal property: either a string or null
                        if (node.value.type === "Literal") {
                            if (typeof node.value.value === "string") {
                                props[node.key.name] = node.value.value;
                            } else if (node.value.value === null) {
                                props[node.key.name] = null;
                            } else {
                                errorNode = node.value;
                                errorMessage = "Must be a string";
                            }
                        }
                        // InsertProperty object
                        else {
                            const insertProperty: InsertProperty = {};
                            for (const subnode of node.value.properties) {
                                if (
                                    subnode.type === "Property" &&
                                    subnode.key.type === "Identifier" &&
                                    subnode.value.type === "Literal"
                                ) {
                                    // "type" property
                                    if (subnode.key.name === "type") {
                                        const valueType =
                                            typeof subnode.value.value ===
                                            "string"
                                                ? ValueType[
                                                      subnode.value
                                                          .value as keyof typeof ValueType
                                                  ]
                                                : undefined;
                                        if (valueType === undefined) {
                                            errorNode = subnode.value;
                                            errorMessage =
                                                "Must be one of " +
                                                Object.keys(ValueType)
                                                    .map((v) => "'" + v + "'")
                                                    .join(", ") +
                                                ".";
                                        } else {
                                            insertProperty.type = valueType;
                                        }
                                    }
                                    // "placeholder" property
                                    else if (
                                        subnode.key.name === "placeholder"
                                    ) {
                                        if (
                                            typeof subnode.value.value ===
                                            "string"
                                        ) {
                                            insertProperty.placeholder =
                                                subnode.value.value;
                                        } else {
                                            errorNode = subnode.value;
                                            errorMessage = "Must be a string";
                                        }
                                    } else {
                                        errorNode = subnode.key;
                                        errorMessage =
                                            "Unrecognized property; must be 'placeholder' or 'type'";
                                    }
                                }
                            }
                            props[node.key.name] = insertProperty;
                        }
                    }
                }
            } else if (
                node.key.type === "Identifier" &&
                ancestors.length === 2 &&
                !hasOwnProperty(args, node.key.name)
            ) {
                errorNode = node.key;
                errorMessage =
                    "Properties other than " +
                    Object.keys(args)
                        .map((v) => "'" + v + "'")
                        .join(", ") +
                    +" are ignored.";
            }

            if (errorNode !== undefined) {
                state.callbacks.onParseError(
                    createDiagnostic(
                        errorSeverity,
                        state.textDocument,
                        contentsIndex + errorNode.start,
                        contentsIndex + errorNode.end,
                        errorMessage
                    )
                );
            }
        }
    );

    if (firstArgRequired !== undefined) {
        args.firstArgument.required = firstArgRequired;
        return args;
    }

    return undefined;
}

/**
 * Information about a custom insert or modifier.
 */
interface CustomInsertOrModifierInformation {
    match: RegExp | undefined;
    matchIndex: number | undefined;
    name: string | undefined;
    description: string | undefined;
    syntax: string | undefined;
    completions: string[] | undefined;
    firstArgument: FirstArgument | undefined;
    requiredProps: InsertPropertyRecord | undefined;
    optionalProps: InsertPropertyRecord | undefined;
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
    const props: CustomInsertOrModifierInformation = {
        match: undefined,
        matchIndex: undefined,
        name: undefined,
        description: undefined,
        syntax: undefined,
        completions: undefined,
        firstArgument: undefined,
        requiredProps: undefined,
        optionalProps: undefined,
    };

    try {
        // Parse the contents as a JavaScript expression so we can extract the properties
        const ast = parseJSExpressionStrict(contents);
        acornWalk.simple(ast, {
            Property(node) {
                if (node.key.type === "Identifier") {
                    // Arguments for a custom insert
                    if (node.key.name === "arguments") {
                        const insertArguments = parseCustomFunctionArguments(
                            node.value,
                            contentsIndex,
                            symbolKind,
                            state
                        );
                        props.firstArgument = insertArguments?.firstArgument;
                        if (symbolKind === OChapbookSymbolKind.CustomInsert) {
                            props.requiredProps =
                                insertArguments?.requiredProps;
                            props.optionalProps =
                                insertArguments?.optionalProps;
                        }
                    }
                    // Completions can be a string or array of strings
                    else if (node.key.name === "completions") {
                        if (
                            node.value.type === "Literal" &&
                            typeof node.value.value === "string"
                        ) {
                            props.completions = [node.value.value];
                        } else if (node.value.type === "ArrayExpression") {
                            const completions: string[] = [];
                            for (const elem of node.value.elements) {
                                if (elem === null) continue;
                                if (
                                    elem.type === "Literal" &&
                                    typeof elem.value === "string"
                                ) {
                                    completions.push(elem.value);
                                } else {
                                    state.callbacks.onParseError(
                                        createDiagnostic(
                                            DiagnosticSeverity.Warning,
                                            state.textDocument,
                                            contentsIndex + elem.start,
                                            contentsIndex + elem.end,
                                            "Completions must be a string or an array of strings"
                                        )
                                    );
                                }
                            }
                            props.completions = completions;
                        } else {
                            state.callbacks.onParseError(
                                createDiagnostic(
                                    DiagnosticSeverity.Warning,
                                    state.textDocument,
                                    contentsIndex + node.value.start,
                                    contentsIndex + node.value.end,
                                    "Completions must be a string or an array of strings"
                                )
                            );
                        }
                    }
                    // String and regex values
                    else if (
                        node.value.type === "Literal" &&
                        hasOwnProperty(props, node.key.name)
                    ) {
                        if (typeof node.value.value === "string") {
                            if (node.key.name === "name") {
                                props.name = node.value.value;
                            } else if (node.key.name === "description") {
                                props.description = node.value.value;
                            } else if (node.key.name === "syntax") {
                                props.syntax = node.value.value;
                            }
                        } else if (
                            node.key.name === "match" &&
                            node.value.value instanceof RegExp
                        ) {
                            // The regex value
                            props.match = node.value.value;
                            props.matchIndex = node.value.start;
                        } else {
                            // We only mark an error for the `match` property, as
                            // that's the only thing Chapbook actually cares about
                            const isMatch = node.key.name === "match";
                            state.callbacks.onParseError(
                                createDiagnostic(
                                    isMatch
                                        ? DiagnosticSeverity.Error
                                        : DiagnosticSeverity.Warning,
                                    state.textDocument,
                                    contentsIndex + node.value.start,
                                    contentsIndex + node.value.end,
                                    "Must be a " +
                                        (isMatch
                                            ? "regular expression"
                                            : "string")
                                )
                            );
                        }
                    }
                }
            },
        });

        // We have to at least have a "match" property to be an insert or modifier
        if (props.match === undefined || props.matchIndex === undefined) return;

        // If there's no "name" property, use the match contents as the name
        if (props.name === undefined) props.name = props.match.source;

        // Custom inserts must have a space in their match object
        if (
            symbolKind === OChapbookSymbolKind.CustomInsert &&
            props.match.source.indexOf(" ") === -1 &&
            props.match.source.indexOf("\\s") === -1
        ) {
            logErrorFor(
                props.match.source,
                props.matchIndex + 1 + contentsIndex, // + 1 to skip the leading "/"
                "Custom inserts must have a space in their match",
                state
            );
        }

        // Save the match as a Regex in the associated label
        const symbol: ChapbookSymbol = {
            name: props.name,
            contents: props.name,
            location: createLocationFor(
                props.match.source,
                props.matchIndex + 1 + contentsIndex, // + 1 to skip the leading "/"
                state.textDocument
            ),
            kind: symbolKind,
            match: props.match,
        };
        if (props.description !== undefined)
            symbol.description = props.description;
        if (props.syntax !== undefined) symbol.syntax = props.syntax;
        if (props.completions !== undefined)
            symbol.completions = props.completions;
        if (props.firstArgument !== undefined)
            symbol.firstArgument = props.firstArgument;
        if (props.requiredProps !== undefined)
            symbol.requiredProps = props.requiredProps;
        if (props.optionalProps !== undefined)
            symbol.optionalProps = props.optionalProps;

        state.callbacks.onSymbolDefinition(symbol);
    } catch (err) {
        if (err instanceof SyntaxError) {
            const pos =
                contentsIndex +
                (hasOwnProperty(err, "pos") ? (err.pos as number) : 0);
            const raisedAt =
                contentsIndex +
                (hasOwnProperty(err, "raisedAt")
                    ? (err.raisedAt as number)
                    : 0);
            state.callbacks.onParseError(
                createDiagnostic(
                    DiagnosticSeverity.Error,
                    state.textDocument,
                    pos,
                    raisedAt,
                    err.message
                )
            );
        }
    }
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
        let curIsGreater = false;
        for (let ndx = 0; ndx < end; ++ndx) {
            if (curVersion[ndx] < minVersion[ndx]) {
                logWarningFor(
                    version,
                    contentsIndex + 1,
                    `The current story format version is ${state.storyFormat.formatVersion}, so this extension will be ignored`,
                    state
                );
                return;
            } else if (curVersion[ndx] > minVersion[ndx]) {
                curIsGreater = true;
                break;
            }
        }

        if (!curIsGreater && curVersion.length < minVersion.length) {
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
    for (const m of contents.matchAll(/engine.extend\(/g)) {
        let ndx = m.index + m[0].length;
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
 * Extract an argument to an insert (either 1st argument or property value) from a string.
 *
 * The returned remaining contents, if any, include the "," after the argument.
 *
 * @param contents Contents of the insert trimmed so the insert argument is at the start of the string.
 * @param contentsIndex Index where the contents occur in the full insert's text.
 * @returns A tuple with the insert argument, the contents that remain after the argument (if any), and the index where the remaining contents occur.
 */
function extractInsertArgument(
    contents: string,
    contentsIndex: number
): [string, string, number] {
    let endIndex: number | undefined = 0;
    const c = contents[0];
    // If the value is a string or has parens, braces, or brackets,
    // move beyond that section as a group before looking for the comma
    // that separates the value from any subsequent properties
    if (c === "'" || c === '"' || c === "{" || c === "[" || c === "(") {
        endIndex = findClosingDelimeterIndex(contents, 0);
    }
    if (endIndex !== undefined) {
        // The argument goes until a comma or the end of the contents
        const commaIndex = contents.indexOf(",", endIndex);
        if (commaIndex !== -1) endIndex = commaIndex;
        else endIndex = contents.length;
        return [
            contents.slice(0, endIndex).trimEnd(),
            contents.slice(endIndex),
            contentsIndex + endIndex,
        ];
    } else {
        return [contents, "", contentsIndex + contents.length];
    }
}

/**
 * Check a function version against the current Chapbook story format version.
 *
 * @param funcInfo Information about the function.
 * @param text How the function was evoked in the document.
 * @param at Where the function was evoked in the document.
 * @param storyFormatVersion Story format version.
 * @param doc Document containing the function.
 * @returns Generated diagnostics.
 */
function validateFunctionVersion(
    funcInfo: ChapbookFunctionInfo,
    text: string,
    at: number,
    storyFormatVersion: string | undefined,
    doc: TextDocument
): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];

    if (storyFormatVersion !== undefined) {
        if (
            funcInfo.since !== undefined &&
            versionCompare(storyFormatVersion, funcInfo.since) <= 0
        ) {
            diagnostics.push(
                createDiagnosticFor(
                    DiagnosticSeverity.Error,
                    doc,
                    text,
                    at,
                    `\`${funcInfo.name}\` isn't available until Chapbook version ${funcInfo.since} but your StoryFormat version is ${storyFormatVersion}`
                )
            );
        } else if (
            funcInfo.removed !== undefined &&
            versionCompare(storyFormatVersion, funcInfo.removed) >= 0
        ) {
            diagnostics.push(
                createDiagnosticFor(
                    DiagnosticSeverity.Error,
                    doc,
                    text,
                    at,
                    `\`${funcInfo.name}\` was removed in Chapbook version ${funcInfo.removed} and your StoryFormat version is ${storyFormatVersion}`
                )
            );
        }
    }

    return diagnostics;
}

/**
 * Parse an argument to a Chapbook function (either insert/modifier 1st argument or insert property value).
 *
 * @param token Token for the argument.
 * @param argType Expected type of argument.
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseFunctionArgument(
    token: Token | undefined,
    argType: ValueType | undefined,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    if (
        token !== undefined &&
        (token.text.startsWith("'") || token.text.startsWith('"'))
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
 * Validate a function version (modifier/insert) and its first argument.
 *
 * @param funcInfo Information about the function.
 * @param name Tokenized function name.
 * @param firstArgument Tokenized first argument to the function.
 * @param storyFormatVersion Current Chapbook format version, if known.
 * @param doc Text document containing the function.
 * @returns List of any diagnostics from validating the function and first argument.
 */
export function validateFunctionAndFirstArgument(
    funcInfo: ChapbookFunctionInfo,
    name: Token,
    firstArgument: Token | undefined,
    storyFormatVersion: string | undefined,
    doc: TextDocument
): Diagnostic[] {
    // Check the story format against insert since/removed version information
    const diagnostics = validateFunctionVersion(
        funcInfo,
        name.text,
        name.at,
        storyFormatVersion,
        doc
    );

    // Check for required and unknown arguments
    // First up, first argument
    if (
        funcInfo.firstArgument?.required === ArgumentRequirement.required &&
        (firstArgument === undefined || firstArgument.text.trim() === "")
    ) {
        diagnostics.push(
            createDiagnosticFor(
                DiagnosticSeverity.Error,
                doc,
                name.text,
                name.at,
                `\`${funcInfo.name}\` requires a first argument`
            )
        );
    } else if (
        funcInfo.firstArgument?.required === ArgumentRequirement.ignored &&
        firstArgument !== undefined &&
        firstArgument.text.trim() !== ""
    ) {
        diagnostics.push(
            createDiagnosticFor(
                DiagnosticSeverity.Warning,
                doc,
                firstArgument.text,
                firstArgument.at,
                `\`${funcInfo.name}\` will ignore this first argument`
            )
        );
    }

    return diagnostics;
}

/**
 * Validate arguments to an insert against that insert's requirements.
 *
 * This function is separate so other functions outside the main parsing loop
 * can generate diagnostics for inserts, as when validating custom inserts,
 * which can't happen until later.
 *
 * @param insert Information about the insert (built-in or custom).
 * @param tokens Tokenized insert information.
 * @param doc Text document containing the insert.
 * @param storyFormatVersion Current Chapbook format version, if know.
 * @returns List of any diagnostics from parsing the contents.
 */
export function validateInsertContents(
    insert: ChapbookFunctionInfo,
    tokens: InsertTokens,
    doc: TextDocument,
    storyFormatVersion?: string
): Diagnostic[] {
    // Check the story format against insert since/removed version information
    // as well as the first argument's existence (or lack thereof)
    const diagnostics = validateFunctionAndFirstArgument(
        insert,
        tokens.name,
        tokens.firstArgument,
        storyFormatVersion,
        doc
    );

    // Check for required and unknown properties
    const seenProperties: Set<string> = new Set();
    for (const [propName, [propNameToken, propValueToken]] of Object.entries(
        tokens.props
    ) as [string, [Token, Token]][]) {
        let propInfo: string | InsertProperty | null | undefined =
            insert.requiredProps?.[propName];

        if (propInfo !== undefined) {
            seenProperties.add(propName);
        } else {
            propInfo = insert.optionalProps?.[propName];
            if (propInfo === undefined)
                diagnostics.push(
                    createDiagnosticFor(
                        DiagnosticSeverity.Warning,
                        doc,
                        propNameToken.text,
                        propNameToken.at,
                        `Insert {${insert.name}} will ignore this property`
                    )
                );
        }
    }
    const unseenProperties = Object.keys(insert.requiredProps || {}).filter(
        (k) => !seenProperties.has(k)
    );
    if (unseenProperties.length > 0) {
        diagnostics.push(
            createDiagnosticFor(
                DiagnosticSeverity.Error,
                doc,
                tokens.name.text,
                tokens.name.at,
                `Insert {${insert.name}} missing expected properties: ${unseenProperties.join(", ")}`
            )
        );
    }

    return diagnostics;
}

/**
 * Parse the contents of an insert, capturing variable references and semantic tokens.
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
            state.textDocument
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

    // If the reference is to a possible custom insert, there's nothing else for us to do right now.
    // Its validation will happen at the overall validation step, since we need access to the
    // full index's custom insert information.
    if (insert === undefined) return;

    // Validate the contents and capture any diagnostics that validation raises
    for (const diagnostic of validateInsertContents(
        insert,
        tokens,
        state.textDocument,
        state.storyFormat?.formatVersion
    )) {
        state.callbacks.onParseError(diagnostic);
    }

    // Capture any tokens associated with the first argument
    parseFunctionArgument(
        tokens.firstArgument,
        insert.firstArgument.type,
        state,
        chapbookState
    );

    // Capture any tokens associated with property arguments
    for (const [propName, [, propValueToken]] of Object.entries(
        tokens.props
    ) as [string, [Token, Token]][]) {
        let propInfo: string | InsertProperty | null | undefined =
            insert.requiredProps[propName] || insert.optionalProps[propName];

        if (InsertProperty.is(propInfo)) {
            parseFunctionArgument(
                propValueToken,
                propInfo.type,
                state,
                chapbookState
            );
        }
    }

    // Finally, let the in-built insert do any parsing it needs to do
    insert.parse(tokens, state, chapbookState);
}

/**
 * Turn the raw text of an insert into tokens.
 *
 * Tokenizing can turn up errors. To capture and report them, pass a parsing state
 * to the function. (This is optional so functions outside of the main parsing loop
 * can re-tokenize an insert, as when validating custom inserts, which can't happen
 * until later.)
 *
 * @param insert Text of the insert, including the {}.
 * @param insertIndex Index in the document where the insert begins (zero-based).
 * @param state Optional parsing state.
 * @returns
 */
export function tokenizeInsert(
    insert: string,
    insertIndex: number,
    state?: ParsingState
): InsertTokens {
    // Functional inserts follow the form: {function name: arg, property1: value1, property2: value2}
    // Get rid of the {} in the insert
    insert = insert.slice(1, -1);
    insertIndex++;

    // Find where the function's name ends
    const functionNameStopChar = /[,:]/g;
    const functionNameEnd = functionNameStopChar.test(insert)
        ? functionNameStopChar.lastIndex - 1
        : insert.length;
    let functionName = insert.slice(0, functionNameEnd);
    let functionIndex = 0;
    [functionName, functionIndex] = skipSpaces(functionName, functionIndex);

    // Tokenized insert information
    // Note that the token's given locations are relative to the entire document
    // instead of being relative to the insert's index.
    const insertTokens: InsertTokens = {
        name: Token.create(functionName, insertIndex + functionIndex),
        firstArgument: undefined,
        props: {},
    };

    let remainingContents = insert.slice(functionNameEnd);
    let remainingContentsIndex = functionNameEnd;

    // If there's a colon after the function name, handle the argument
    if (remainingContents[0] === ":") {
        let argumentIndex = remainingContentsIndex + 1; // Skip the ":"
        let argument = remainingContents.slice(1);
        [argument, argumentIndex] = skipSpaces(argument, argumentIndex);

        [argument, remainingContents, remainingContentsIndex] =
            extractInsertArgument(argument, argumentIndex);

        // Save the tokens and parse the argument as a JS expression
        insertTokens.firstArgument = Token.create(
            argument,
            insertIndex + argumentIndex
        );
    }

    // If there's a comma after the function section, tokenize the properties
    if (remainingContents[0] === ",") {
        while (remainingContents.trim()) {
            if (remainingContents[0] === ",") {
                // Skip the comma
                remainingContents = remainingContents.slice(1);
                remainingContentsIndex++;
            }
            // Get the property name, which goes up to the next colon
            const colonIndex = remainingContents.indexOf(":");
            if (colonIndex === -1) break;
            let currentProperty = remainingContents.slice(0, colonIndex);
            let currentPropertyIndex = remainingContentsIndex;
            [currentProperty, currentPropertyIndex] = skipSpaces(
                currentProperty,
                currentPropertyIndex
            );
            remainingContentsIndex += colonIndex + 1; // To skip the ":"
            remainingContents = remainingContents.slice(colonIndex + 1);

            // Properties can't have spaces bee tee dubs
            const spaceIndex = currentProperty.lastIndexOf(" ");
            if (spaceIndex !== -1 && state !== undefined) {
                logErrorFor(
                    currentProperty,
                    insertIndex + currentPropertyIndex,
                    "Properties can't have spaces",
                    state
                );
            }

            // The property's value extends to the next comma (indicating another property)
            // or the end of the insert
            let currentValueIndex = remainingContentsIndex;
            let currentValue = remainingContents;
            [currentValue, currentValueIndex] = skipSpaces(
                currentValue,
                currentValueIndex
            );

            [currentValue, remainingContents, remainingContentsIndex] =
                extractInsertArgument(currentValue, currentValueIndex);

            // If the property is well formed, capture it to pass to individual inserts
            if (spaceIndex === -1) {
                insertTokens.props[currentProperty] = [
                    Token.create(
                        currentProperty,
                        insertIndex + currentPropertyIndex
                    ),
                    Token.create(currentValue, insertIndex + currentValueIndex),
                ];
            }
        }
    }

    return insertTokens;
}

/**
 * Parse a Chapbook insert or variable.
 *
 * Captures semantic tokens and variable references inside the {variable} or {insert function},
 * and (if an insert) checks the insert's arguments.
 *
 * @param insert Text of the insert, including the {}.
 * @param insertIndex Index in the document where the insert begins (zero-based).
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseInsertOrVariable(
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

        // Parse the value as JavaScript
        createVariableAndPropertyReferences(
            tokenizeJSExpression(
                invocation,
                insertIndex + invocationIndex,
                state,
                chapbookState
            ),
            state
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

        return;
    }

    // Functional inserts follow the form: {function name: arg, property1: value1, property2: value2}
    const insertTokens = tokenizeInsert(insert, insertIndex, state);

    // Note that the tokens' given locations are relative to the entire document
    // instead of being relative to the insert's index.

    // Create semantic tokens and variable references for the arugment and properties
    if (insertTokens.firstArgument !== undefined) {
        // Parse the first argument as a JS expression and capture semantic tokens & var references
        createVariableAndPropertyReferences(
            tokenizeJSExpression(
                insertTokens.firstArgument.text,
                insertTokens.firstArgument.at,
                state,
                chapbookState
            ),
            state
        );
    }
    for (const [, propValueToken] of Object.values(insertTokens.props) as [
        Token,
        Token,
    ][]) {
        // Parse properties' values as JavaScript
        createVariableAndPropertyReferences(
            tokenizeJSExpression(
                propValueToken.text,
                propValueToken.at,
                state,
                chapbookState
            ),
            state
        );
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
        // We'll tokenize the contents, but not capture variable and
        // property references, as they mostly won't be set in Chapbook
        // vars sections and thus would cause a lot of spurious warnings
        tokenizeJSExpression(subsection, subsectionIndex, state, chapbookState);
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
                            parseInsertOrVariable(
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
 * Turn the raw text of a modifier into tokens.
 *
 * @param modifierText Full modifier text without the brackets ([]).
 * @param modifierIndex Index in the document where the modifier text begins (zero-based).
 * @param modifierInfo Info about the modifier that goes with the modifierText (if any).
 * @returns Tokens for the modifier, or undefined if the text doesn't match the modifier information.
 */
export function tokenizeModifier(
    modifierText: string,
    modifierIndex: number,
    modifierInfo: ChapbookFunctionInfo | undefined
): ModifierTokens | undefined {
    const match = modifierInfo?.match.exec(modifierText) || undefined;
    if (match !== undefined) {
        const modifierName = match[0];
        modifierIndex += match.index;
        let modifierArg = modifierText.substring(
            match.index + modifierName.length
        );
        let modifierArgIndex = modifierIndex + modifierName.length;
        [modifierArg, modifierArgIndex] = skipSpaces(
            modifierArg,
            modifierArgIndex
        );
        return {
            name: Token.create(modifierName, modifierIndex),
            firstArgument:
                modifierArg !== ""
                    ? Token.create(modifierArg, modifierArgIndex)
                    : undefined,
        };
    }

    return undefined;
}

/**
 * Parse the contents of a Chapbook modifier.
 *
 * @param modifierText Full modifier text without the brackets ([]).
 * @param modifierIndex Index in the document where the modifier text begins (zero-based).
 * @param state Parsing state.
 * @param chapbookState Chapbook-specific parsing state.
 */
function parseModifier(
    modifierText: string,
    modifierIndex: number,
    state: ParsingState,
    chapbookState: ChapbookParsingState
): void {
    [modifierText, modifierIndex] = skipSpaces(modifierText, modifierIndex);
    if (modifierText === "") {
        return;
    }

    const modifier = allModifiers().find((i) => i.match.test(modifierText));

    const modifierTokens = tokenizeModifier(
        modifierText,
        modifierIndex,
        modifier
    );
    // If we recognize the modifier, check its version and let it parse the contents,
    // which can set the text block state in chapbookState
    if (modifier !== undefined && modifierTokens !== undefined) {
        // Store a reference to the insert
        state.callbacks.onSymbolReference(
            createSymbolFor(
                modifierTokens.name.text,
                modifierTokens.name.at,
                OChapbookSymbolKind.BuiltInModifier,
                state.textDocument
            )
        );

        // Handle modifier-specific parsing, which can set the text block state in chapbookState
        // (This needs to be done before setting tokens)
        modifier.parse(modifierText, state, chapbookState);

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
            modifierTokens.name.text,
            modifierTokens.name.at,
            chapbookState.modifierKind == ModifierKind.Note
                ? ETokenType.comment
                : ETokenType.function,
            deprecated ? [ETokenModifier.deprecated] : [],
            chapbookState
        );

        // Validate the function information and its first argument
        for (const diagnostic of validateFunctionAndFirstArgument(
            modifier,
            modifierTokens.name,
            modifierTokens.firstArgument,
            state.storyFormat?.formatVersion,
            state.textDocument
        )) {
            state.callbacks.onParseError(diagnostic);
        }

        // If there's an argument to the modifier, tokenize and parse it
        if (modifierTokens.firstArgument !== undefined) {
            // If the modifier's argument has a type, then we tokenize it as JS.
            // Otherwise, tokenize it as function parameters
            if (modifier.firstArgument?.type !== undefined) {
                createVariableAndPropertyReferences(
                    tokenizeJSExpression(
                        modifierTokens.firstArgument.text,
                        modifierTokens.firstArgument.at,
                        state,
                        chapbookState
                    ),
                    state
                );
            } else {
                // Tokenize
                capturePreTokenFor(
                    modifierTokens.firstArgument.text,
                    modifierTokens.firstArgument.at,
                    ETokenType.parameter,
                    [],
                    chapbookState
                );
            }

            // Parsing happens after tokenizing b/c parsing can
            // change what semantic tokens apply
            parseFunctionArgument(
                modifierTokens.firstArgument,
                modifier.firstArgument?.type,
                state,
                chapbookState
            );
        }
    } else {
        // Store a reference to the (custom) modifier
        state.callbacks.onSymbolReference(
            createSymbolFor(
                modifierText,
                modifierIndex,
                OChapbookSymbolKind.CustomModifier,
                state.textDocument
            )
        );

        // Tokenize the entire thing as a function
        capturePreTokenFor(
            modifierText,
            modifierIndex,
            ETokenType.function,
            [],
            chapbookState
        );
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
 * Parse only the variables and their properties being set in the vars section of a Chapbook passage.
 *
 * @param section The vars section.
 * @param sectionIndex Index in the document where the vars section begins (zero-based).
 * @param state Parsing state
 */
function parseVarsSectionForSetVarsAndPropsOnly(
    section: string,
    sectionIndex: number,
    state: ParsingState
): void {
    // Parse line by line
    varsLineVarOnlyExtractionPattern.lastIndex = 0;
    for (const m of section.matchAll(varsLineVarOnlyExtractionPattern)) {
        // Matches are [line (0), leading whitespace (1), variable name (and properties) being set (2; may not be there)]
        if (m[2] !== undefined) {
            const ndx = sectionIndex + m.index + m[1].length;
            let scope = "";
            for (const [i, elem] of m[2].split(".").entries()) {
                state.callbacks.onSymbolReference({
                    contents: scope + elem,
                    location: createLocationFor(
                        elem,
                        ndx + scope.length,
                        state.textDocument
                    ),
                    kind:
                        i == 0
                            ? OChapbookSymbolKind.VariableSet
                            : OChapbookSymbolKind.PropertySet,
                });
                scope += `${elem}.`;
            }
        }
    }
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
    varsLineExtractionPattern.lastIndex = 0;
    for (const m of section.matchAll(varsLineExtractionPattern)) {
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
                createVariableAndPropertyReferences(
                    tokenizeJSExpression(
                        conditionMatch[3],
                        sectionIndex +
                            conditionMatchIndex +
                            conditionMatch[0].indexOf(conditionMatch[3]),
                        state,
                        chapbookState
                    ),
                    state
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

        // Capture the variable name reference as being set by this vars section
        // and update the token for the name to show that it's being modified.
        createVariableAndPropertyReferences(
            tokenizeJSExpression(
                name,
                sectionIndex + nameIndex,
                state,
                chapbookState
            ),
            state,
            true
        );
        // Capture tokens for variables and properties
        const varsAndProps = name.split(".");
        for (let i = 0, ndx = nameIndex; i < varsAndProps.length; ++i) {
            capturePreTokenFor(
                varsAndProps[i],
                sectionIndex + ndx,
                i == 0 ? ETokenType.variable : ETokenType.property,
                [ETokenModifier.modification],
                chapbookState
            );
            ndx += varsAndProps[i].length + 1; // + 1 for the period
        }

        // Handle the value
        let [value, valueIndex] = skipSpaces(
            m[2].slice(colonIndex + 1),
            m.index + m[1].length + colonIndex + 1
        );
        createVariableAndPropertyReferences(
            tokenizeJSExpression(
                value,
                sectionIndex + valueIndex,
                state,
                chapbookState
            ),
            state
        );
    }
}

/**
 * A Chapbook passage divided into the vars and content sections.
 */
interface ChapbookPassageParts {
    // Text of the vars section, not including the "--" separator, if it exists.
    vars?: string;
    // Text of the content section.
    content: string;
    // Index where the content is relative to the start of the passage.
    contentIndex: number;
}

/**
 * Divide a Chapbook passage into the (optional) vars section and the text.
 *
 * @param passageText Full text of the passage.
 * @returns Information about the vars section, or undefined if there is no vars section.
 */
export function divideChapbookPassage(
    passageText: string
): ChapbookPassageParts {
    const passageParts: ChapbookPassageParts = {
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
    if (state.parseLevel !== ParseLevel.Full) {
        if (state.parseLevel === ParseLevel.PassageNames) {
            // Even if we don't parse passage contents, look for calls to
            // `engine.extend()` so we can capture custom inserts and modifiers
            findEngineExtensions(passageText, textIndex, state);
            // as well as variables being set
            const passageParts = divideChapbookPassage(passageText);
            if (passageParts.vars !== undefined) {
                parseVarsSectionForSetVarsAndPropsOnly(
                    passageParts.vars,
                    textIndex,
                    state
                );
            }
        }
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
