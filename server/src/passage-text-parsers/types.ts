import {
    CompletionList,
    Definition,
    Diagnostic,
    DocumentUri,
    Hover,
    Location,
    LSPErrorCodes,
    Position,
    ResponseError,
    TextEdit,
} from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { DiagnosticCode, StoryFormat } from "@tt3/shared";
import { EmbeddedDocument } from "../embedded-languages";
import { ParseLevel, ParserCallbacks } from "../parser-types";
import { Passage, ProjectIndex } from "../project-index";
import { isIdentifierName } from "../script-analysis";
import { TokenModifier, TokenType } from "../semantic-tokens";

/**
 * Captures information about the current state of parsing
 */
export interface ParsingState {
    /**
     * Document being validated.
     */
    textDocument: TextDocument;
    /**
     * Are we to parse passage contents?
     */
    parseLevel: ParseLevel;
    /**
     * Is the text being parsed is an entire local `.js` file rather than
     * a passage?
     */
    isWholeFile?: boolean;
    /**
     * What passage are we currently parsing the contents of?
     */
    currentPassage?: Passage;
    /**
     * What diagnostic codes are currently disabled for this passage?
     */
    currentPassageDisabledDiagnostics?: Set<DiagnosticCode>;
    /**
     * Story format (if known).
     */
    storyFormat?: StoryFormat;
    /**
     * The parser to parse passage contents (other than the StoryTitle and StoryData passages).
     */
    storyFormatParser: StoryFormatParser | undefined;
    /**
     * Callbacks for parsing events
     */
    callbacks: ParserCallbacks;
}

/**
 * Story-format-specific parsers that parse passage text.
 */
export interface StoryFormatParser {
    /**
     * ID for the parser: "format-version" where "version" is the e.g. "1.0.0" version.
     */
    id: string;
    /**
     * Parse a Twine passage's text.
     *
     * Note that this may be called even when state.parseLevel indicates that the passage
     * contents shouldn't be parsed. That's in case story formats need to index information
     * for project-wide diagnostics even if they're not doing a full passage contents parse.
     * It's up to the story format to check for that.
     *
     * Note also that the passage may be a script passage, which we pass in case the story
     * format needs to process the contents.
     *
     * @param passageText Text of the passage to parse.
     * @param textIndex Index of the passage in the document (zero-based).
     * @param state Parsing state.
     */
    parsePassageText(
        passageText: string,
        textIndex: number,
        state: ParsingState,
    ): void;
    /**
     * Generate completions at a position.
     *
     * @param document Document to generate completions in.
     * @param position Position in the document to generate completions.
     * @param deferredEmbeddedDocuments List of embedded documents at the position that the story format is responsible for handling.
     * @param index Twine project index.
     * @returns Completion list, or null for no completions.
     */
    generateCompletions(
        document: TextDocument,
        position: Position,
        deferredEmbeddedDocuments: EmbeddedDocument[],
        index: ProjectIndex,
    ): CompletionList | null;
    /**
     * Generate diagnostics.
     *
     * @param document Document to generate diagnostics for.
     * @param index Twine project index.
     */
    generateDiagnostics(
        document: TextDocument,
        index: ProjectIndex,
    ): Diagnostic[];
    /**
     * Generate hover information.
     *
     * @param document Document to generate hover information for.
     * @param position Position in the document to generate hover information.
     * @param deferredEmbeddedDocuments List of embedded documents at the position that the story format is responsible for handling.
     * @param index Project index.
     * @returns Hover information, or null for no hover information.
     */
    generateHover(
        document: TextDocument,
        position: Position,
        deferredEmbeddedDocuments: EmbeddedDocument[],
        index: ProjectIndex,
    ): Hover | null;
    /**
     * Get a symbol's definition by a position in a document.
     *
     * This is a fallback function: Story formats can define this if the default index logic
     * won't find all of the format's definitions. Otherwise, they can simply return undefined.
     *
     * @param document Document to get definition at.
     * @param position Position in the document to find the definition from.
     * @param index Twine project index.
     * @returns Definition, or undefined for no definition at the given position.
     */
    getDefinitionAt(
        document: TextDocument,
        position: Position,
        index: ProjectIndex,
    ): Definition | undefined;
    /**
     * Get references to a symbol by a position in a document.
     *
     * Story formats can define this if they need to handle references differently than
     * the project index does by default, such as if they track variable-setting references
     * differently than variable-reading references.
     *
     * If it returns null, then the server will use the default reference-finding logic.
     *
     * @param documentUri URI to the document to get references at.
     * @param position Position in the document to find the references from.
     * @param index Twine project index.
     * @param includeDefinition If true, include the symbol's definition in the references.
     * @returns Reference locations, or undefined for no symbol at the given position.
     */
    getReferencesToSymbolAt(
        documentUri: string,
        position: Position,
        index: ProjectIndex,
        includeDeclaration: boolean,
    ): Location[] | undefined | null;
    /**
     * Can the symbol at a position be renamed?
     *
     * Story formats can define this to rule out symbols they index that
     * aren't renamable, so another rename provider can handle the position.
     * If it's not defined, every indexed symbol can be renamed.
     *
     * @param documentUri URI to the document with the symbol.
     * @param position Symbol's position in the document.
     * @param index Twine project index.
     * @returns False if the symbol can't be renamed.
     */
    isRenamableAt?(
        documentUri: string,
        position: Position,
        index: ProjectIndex,
    ): boolean;
    /**
     * Generate renames for a symbol as referenced by its position in a document.
     *
     * Story formats can define this if they need to handle how renames occur, such as
     * if they have variables that have different prefixes in different locations.
     *
     * If it returns null, then the server will use the default rename generation logic.
     *
     * @param documentUri URI to the document with the original reference.
     * @param position Reference's position in the document.
     * @param newName Reference's new name.
     * @param index Twine project index.
     * @returns Edits to perform the rename, undefined if there's nothing to rename, or an error if the rename would produce a wrong result.
     */
    generateRenamesAt(
        documentUri: string,
        position: Position,
        newName: string,
        index: ProjectIndex,
    ): { [uri: DocumentUri]: TextEdit[] } | RenameRefusal | undefined | null;
}

/**
 * A rename that's refused because there's no correct result.
 */
export type RenameRefusal = ResponseError<void>;

/**
 * Refuse a rename.
 *
 * @param message Why the rename was refused (to be shown to the author).
 */
export function refuseRename(message: string): RenameRefusal {
    return new ResponseError(LSPErrorCodes.RequestFailed, message);
}

/**
 * Refuse renaming a story property to a name that isn't a JavaScript
 * identifier.
 *
 * @param contents The property's full dotted path.
 * @param newName New name for the property's last segment.
 * @returns The refusal, or undefined if the new name is fine.
 */
export function refuseInvalidPropertyName(
    contents: string,
    newName: string,
): RenameRefusal | undefined {
    if (isIdentifierName(newName)) return undefined;
    const oldName = contents.slice(contents.lastIndexOf(".") + 1);
    return refuseRename(
        `Can't rename \`${oldName}\` to \`${newName}\`: \`${newName}\` isn't a valid JavaScript identifier.`,
    );
}

/**
 * Raw contents for a semantic token.
 */
interface PreSemanticToken {
    /**
     * Token text.
     */
    text: string;
    /**
     * Index for the token's location in the document (zero-based).
     */
    at: number;
    /**
     * Type of token.
     */
    type: TokenType;
    /**
     * Token modifiers.
     */
    modifiers: TokenModifier[];
}

/**
 * Story-format-specific parsing state information
 */
export interface StoryFormatParsingState {
    /**
     * Information for semantic tokens generated in a text subsection.
     */
    passageTokens: Record<number, PreSemanticToken>;
    /**
     * Host globals (e.g. from the browser and any libraries like jQuery)
     * that aren't counted as story variables for this format, plus any
     * story-format built-ins the format wants excluded.
     */
    hostGlobals?: ReadonlySet<string>;
}

/**
 * Capture pre-semantic-token information for later transmission.
 *
 * @param text Document text to tokenize.
 * @param at Index where the text occurs in the document (zero-based).
 * @param type Token type.
 * @param modifiers Token modifiers.
 * @param storyFormatState Story format parsing state.
 */
export function capturePreSemanticTokenFor(
    text: string,
    at: number,
    type: TokenType,
    modifiers: TokenModifier[],
    storyFormatState: StoryFormatParsingState,
): void {
    if (text.length)
        storyFormatState.passageTokens[at] = {
            text,
            at,
            type,
            modifiers,
        };
}

/**
 * Tokenize against a scratch story format state, then capture its semantic tokens in the real one.
 *
 * @param storyFormatState Story format parsing state to capture the semantic tokens in.
 * @param tokenize Tokenizer that captures semantic tokens in the scratch state it's given.
 * @param relocate Predicate to give each scratch semantic token's text and location in the real state,
 * or undefined to drop it.
 * @returns The tokenizer's result.
 */
export function tokenizeWithScratchState<T>(
    storyFormatState: StoryFormatParsingState,
    tokenize: (scratchState: StoryFormatParsingState) => T,
    relocate: (
        token: Readonly<PreSemanticToken>,
        result: T,
    ) => { text: string; at: number } | undefined,
): T {
    const scratchState: StoryFormatParsingState = {
        passageTokens: {},
        hostGlobals: storyFormatState.hostGlobals,
    };
    const result = tokenize(scratchState);
    for (const t of Object.values(scratchState.passageTokens)) {
        const relocated = relocate(t, result);
        if (relocated !== undefined) {
            capturePreSemanticTokenFor(
                relocated.text,
                relocated.at,
                t.type,
                t.modifiers,
                storyFormatState,
            );
        }
    }
    return result;
}
