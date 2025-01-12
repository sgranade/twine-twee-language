/**
 * Adapted from SugarCube's `lexer.js`, `parserlib.js`, and `wikifer.js`,
 * as well as Twee3-Language-Tools's `arguments.ts`
 */

import {
    logErrorFor,
    parsePassageReference,
    ParsingState,
} from "../../../parser";
import { ETokenType } from "../../../semantic-tokens";
import { skipSpaces } from "../../../utilities";
import { capturePreSemanticTokenFor, StoryFormatParsingState } from "../..";
import { Token } from "../../types";
import { createVariableAndPropertyReferences } from "../sugarcube-utils";
import {
    isTwineScriptExpression,
    tokenizeTwineScriptExpression,
} from "./sc2-twinescript";

/**
 * Utility functions for the LSP to capture tokens as we parse.
 */

/**
 * Parse text that may be either a passage reference or a TwineScript expression.
 *
 * @param text Text to parse.
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 */
export function parseSugarCubePassageRefOrTwinescriptExpr(
    text: string,
    textIndex: number,
    state: ParsingState,
    sugarcubeState: StoryFormatParsingState
) {
    // SC2 treats a link expression or data-passage attribute as a passage reference
    // unless and until it's not found, at which point it's treated as if it's
    // TwineScript. We'll do a bit of tap-dancing to decide if the link refers to a
    // passage or is TwineScript.
    //
    // If someone ever literally names a passage `"Go to" + $destinationVar`, boy won't
    // we look foolish.
    if (isTwineScriptExpression(text)) {
        createVariableAndPropertyReferences(
            tokenizeTwineScriptExpression(
                text,
                textIndex,
                state.textDocument,
                sugarcubeState
            ),
            state
        );
    } else {
        parsePassageReference(text, textIndex, state, sugarcubeState);
    }
}

/**
 * Parse an SC2 Twine link.
 *
 * @param text Text to parse.
 * @param linkIndex Index in text where the link begins (zero-based).
 * @param textIndex Index of the text in the document (zero-based).
 * @param state Parsing state.
 * @param sugarcubeState SugarCube-specific parsing state.
 * @returns The markup data about the link.
 */
export function parseSugarCubeTwineLink(
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
        parseSugarCubePassageRefOrTwinescriptExpr(
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
        logErrorFor(error.text, error.at + textIndex, error.message, state);
    }

    return markupData;
}

/**
 * Adapted from SugarCube's `lexer.js`, `parserlib.js`, and `wikifer.js`,
 * as well as Twee3-Language-Tools's `arguments.ts`
 */

type LexerState<T> = (lexer: Lexer<T>) => null | LexerState<T>;
interface LexerEntry<T> {
    type: T;
    text: string;
    start: number;
    position: number;
}
interface LexerError<T> extends LexerEntry<T> {
    message: string;
}
type LexerItem<T> = LexerEntry<T> | LexerError<T>;

// The EOF type so that we can specify a function that can return end-of-file.
type EOFT = -1;
const EOF: EOFT = -1;

class Lexer<T> {
    /**
     * The text that is being lexed
     */
    readonly source: string;
    /**
     * A function that is the active state, essentially forming a state machine.
     */
    state: LexerState<T> | null;
    /**
     * The start of an entry
     */
    start: number = 0;
    /**
     * Position within the source
     */
    pos: number = 0;
    /**
     * Current nesting depth of ()/{}/[]
     */
    depth: number = 0;
    /**
     * Parsed entries/errors.
     */
    items: LexerItem<T>[] = [];
    /**
     * Data
     */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    data: Record<string, any> = {};

    constructor(source: string, initial: LexerState<T>) {
        this.source = source;
        this.state = initial;
    }

    /**
     * Run the lexer on the source.
     * @returns {LexerItem<T>} The items that were parsed (`this.items`)
     */
    run(): LexerItem<T>[] {
        while (this.state !== null) {
            this.state = this.state(this);
        }

        return this.items;
    }

    /**
     * Acquire next character, or receive EOF.
     * Advances position.
     */
    next(): EOFT | string {
        const ch = this.peek();
        this.pos++;
        return ch;
    }

    /**
     * Acquire next character, or receive EOF.
     * Does not advance position.
     */
    peek(): EOFT | string {
        if (this.pos >= this.source.length) {
            return EOF;
        }
        return this.source[this.pos];
    }

    /**
     * Back the lexer's position up.
     *
     * @param num Number of characters to back up by. If undefined, backs up by one.
     */
    backup(num?: number) {
        this.pos -= num ?? 1;
    }

    /**
     * Advance the lexer's position.
     *
     * @param num Number of characters to go forward. if undefined, goes forward by one.
     */
    forward(num?: number) {
        this.pos += num ?? 1;
    }

    /**
     * Ignore the text from the start of an entry to the current position.
     */
    ignore() {
        this.start = this.pos;
    }

    /**
     * See if the next character is one of the acceptable characters.
     *
     * If the acceptable character is found, then the lexer advances by
     * one. If not, it stays at the same position.
     *
     * @param valid String of characters to accept.
     * @returns True if the character was found; false otherwise.
     */
    accept(valid: string): boolean {
        const ch = this.next();

        if (ch === EOF) {
            return false;
        } else if (valid.includes(ch as string)) {
            return true;
        } else {
            this.backup();
            return false;
        }
    }

    /**
     * Accept a run of characters that are acceptable.
     *
     * Advances the lexer to a position where the next character is
     * not in the valid list, or is at the file's end.
     *
     * @param valid String of characters to accept
     */
    acceptRun(valid: string) {
        for (;;) {
            const ch = this.next();

            if (ch === EOF) {
                return;
            } else if (!valid.includes(ch as string)) {
                break;
            }
        }

        this.backup();
    }

    /**
     * Emit a new lexed item from the start to the current position.
     *
     * @param type Type of item to emit.
     */
    emit(type: T) {
        this.items.push({
            type,
            text: this.source.slice(this.start, this.pos),
            start: this.start,
            position: this.pos,
        });
        this.start = this.pos;
    }

    /**
     * Emit a new error.
     *
     * @param type Type of item to emit.
     * @param message Error message.
     */
    error(type: T, message: string): null {
        this.items.push({
            type,
            message,
            text: this.source.slice(this.start, this.pos),
            start: this.start,
            position: this.pos,
        });
        return null;
    }
}

export interface ArgumentToken extends Token {
    type: MacroParse.Item;
    /**
     * Any additional information, like the error message from a parsing error.
     */
    message?: string;
}

/**
 * Lexes arguments to a SugarCube macro.
 *
 * All token positions are relative to sourceIndex.
 *
 * Adapted from `parseMacroArgs()` in `parserlib.js` from SugarCube by way of
 * `arguments.ts` from Twee3-Language-Tools, with the addition of parsing
 * arrays and objects.
 *
 * @param source Raw string of arguments passed to a macro.
 * @param sourceIndex Index into the larger document where source occurs (zero-based).
 * @returns Array of argument tokens.
 */
export function tokenizeMacroArguments(
    source: string,
    sourceIndex: number
): ArgumentToken[] {
    const tokens: ArgumentToken[] = [];

    const lexer = new Lexer(source, MacroParse.lexSpace);
    for (const item of lexer.run()) {
        const token: ArgumentToken = {
            text: item.text,
            at: item.start + sourceIndex,
            type: item.type,
        };

        if (item.type === MacroParse.Item.Error) {
            token.message = `Unable to parse macro argument: ${(item as LexerError<MacroParse.Item>).message}`;
        }

        tokens.push(token);

        // If we encounter an error, throw up our hands
        if (token.type === MacroParse.Item.Error) {
            break;
        }
    }

    return tokens;
}

/**
 * Markup data about Twine links.
 */
export interface LinkMarkupData {
    error?: { text: string; at: number; message: string };
    isImage: boolean;
    isLink: boolean;
    align?: "left" | "right";
    endPosition: number;
    forceInternal?: boolean;
    /**
     * Link destination
     */
    link?: Token;
    /**
     * The TwineScript setter expression
     */
    setter?: Token;
    /**
     * Image source (for image bracket expressions)
     */
    source?: Token;
    /**
     * Link or image alt text
     */
    text?: Token;
    /**
     * Delimiter (`|`, `<-`, or `->`)
     */
    delim?: Token;
}

/**
 * Parse square bracket markup.
 *
 * Adapted from `parseSquareBracketedMarkup()` in `wikifier.js` from SugarCube by way of
 * `arguments.ts` from Twee3-Language-Tools.
 *
 * @param source Source text containing the square bracket.
 * @param matchStart Starting index of the square bracket in the source.
 * @returns
 */
export function parseSquareBracketedMarkup(
    source: string,
    matchStart: number
): LinkMarkupData {
    // Initialize the lexer.
    const lexer = new Lexer(source, SquareBracketParsing.lexLeftMeta);

    // Set the initial positions within the source string.
    lexer.start = lexer.pos = matchStart;

    // Lex the raw argument string.
    const markup: Partial<LinkMarkupData> = {
        isImage: false,
        isLink: false,
    };
    const items = lexer.run();
    const last = items[items.length - 1];

    if (last && last.type === SquareBracketParsing.Item.Error) {
        markup.error = {
            text: last.text,
            at: last.start,
            message: (last as LexerError<SquareBracketParsing.Item>).message,
        };
    } else {
        items.forEach((item) => {
            const [text, at] = skipSpaces(item.text, item.start);

            switch (item.type) {
                case SquareBracketParsing.Item.ImageMeta:
                    markup.isImage = true;

                    if (text[1] === "<") {
                        markup.align = "left";
                    } else if (text[1] === ">") {
                        markup.align = "right";
                    }
                    break;

                case SquareBracketParsing.Item.LinkMeta:
                    markup.isLink = true;
                    break;

                case SquareBracketParsing.Item.Link:
                    if (text[0] === "~") {
                        markup.forceInternal = true;
                        markup.link = { text: text.slice(1), at: at + 1 };
                    } else {
                        markup.link = { text: text, at: at };
                    }
                    break;

                case SquareBracketParsing.Item.Setter:
                    markup.setter = { text: text, at: at };
                    break;

                case SquareBracketParsing.Item.Source:
                    markup.source = { text: text, at: at };
                    break;

                case SquareBracketParsing.Item.Text:
                    markup.text = { text: text, at: at };
                    break;

                case SquareBracketParsing.Item.DelimLTR:
                case SquareBracketParsing.Item.DelimRTL:
                    markup.delim = { text: text, at: at };
            }
        });
    }

    markup.endPosition = lexer.pos;
    return markup as LinkMarkupData;
}

// Adapted from `parseArgs` in `parserlib.js` from SugarCube
// by way of `arguments.ts` from Twee3-Language-Tools
export namespace MacroParse {
    export enum Item {
        Error,
        Bareword,
        Expression, // `expression` in backticks
        String,
        SquareBracket, // [[passage]]
        Container, // one-line array [] or JS object {}
    }

    // Lexing functions.
    function slurpQuote(lexer: Lexer<Item>, endQuote: string): EOFT | number {
        for (;;) {
            const next = lexer.next();
            if (next === "\\") {
                const ch = lexer.next();

                if (ch !== EOF && ch !== "\n") {
                    continue;
                }
                return EOF;
            } else if (next === EOF) {
                return EOF;
            } else if (next === "\n" && endQuote !== "`") {
                // This is special-cased for ` because it might have newlines inside it.
                return EOF;
            } else if (next === endQuote) {
                break;
            }
        }

        return lexer.pos;
    }

    // SRG added to consume a one-line array [] or JS object {}
    function slurpBracket(
        lexer: Lexer<Item>,
        startBracket: string
    ): EOFT | number {
        const endBracket = startBracket === "{" ? "}" : "]";
        let depth = 1;
        for (;;) {
            const next = lexer.next();
            if (next === "\\") {
                const ch = lexer.next();

                if (ch !== EOF && ch !== "\n") {
                    continue;
                }
                return EOF;
            } else if (next === EOF) {
                return EOF;
            } else if (next === "'" || next === '"' || next === "`") {
                // Get rid of quotes
                if (slurpQuote(lexer, next) === EOF) {
                    return EOF;
                }
            } else if (next === startBracket) {
                ++depth;
            } else if (next === endBracket) {
                if (--depth === 0) {
                    break;
                }
            }
        }

        return lexer.pos;
    }

    export function lexSpace(lexer: Lexer<Item>): LexerState<Item> | null {
        const offset = lexer.source.slice(lexer.pos).search(/\S/);

        if (offset === EOF) {
            // no non-whitespace characters, so bail
            return null;
        } else if (offset !== 0) {
            lexer.pos += offset;
            lexer.ignore();
        }

        // determine what the next state is
        switch (lexer.next()) {
            case "`":
                return lexExpression;
            case '"':
                return lexDoubleQuote;
            case "'":
                return lexSingleQuote;
            case "[":
                return lexSquareBracket;
            // SRG: added to handle JS objects
            case "{":
                return lexJSObject;
            default:
                return lexBareword;
        }
    }

    function lexExpression(lexer: Lexer<Item>): LexerState<Item> | null {
        if (slurpQuote(lexer, "`") === EOF) {
            return lexer.error(Item.Error, "unterminated backquote expression");
        }

        lexer.emit(Item.Expression);
        return lexSpace;
    }

    function lexDoubleQuote(lexer: Lexer<Item>): LexerState<Item> | null {
        if (slurpQuote(lexer, '"') === EOF) {
            return lexer.error(Item.Error, "unterminated double quoted string");
        }

        lexer.emit(Item.String);
        return lexSpace;
    }

    function lexSingleQuote(lexer: Lexer<Item>): LexerState<Item> | null {
        if (slurpQuote(lexer, "'") === EOF) {
            return lexer.error(Item.Error, "unterminated single quoted string");
        }

        lexer.emit(Item.String);
        return lexSpace;
    }

    function lexSquareBracket(lexer: Lexer<Item>): LexerState<Item> | null {
        const imgMeta = "<>IiMmGg";
        let what;

        if (lexer.accept(imgMeta)) {
            what = "image";
            lexer.acceptRun(imgMeta);
        } else {
            what = "link";
        }

        if (!lexer.accept("[")) {
            // SRG accept single brackets as arrays
            if (slurpBracket(lexer, "[") === EOF) {
                return lexer.error(Item.Error, `malformed ${what} markup`);
            } else {
                lexer.emit(Item.Container);
                return lexSpace;
            }
        }

        lexer.depth = 2; // account for both initial left square brackets

        loop: for (;;) {
            switch (lexer.next()) {
                case "\\": {
                    const ch = lexer.next();

                    if (ch !== EOF && ch !== "\n") {
                        break;
                    }
                }
                /* falls through */
                case EOF:
                case "\n":
                    return lexer.error(
                        Item.Error,
                        `unterminated ${what} markup`
                    );

                case "[":
                    ++lexer.depth;
                    break;

                case "]":
                    --lexer.depth;

                    if (lexer.depth < 0) {
                        return lexer.error(
                            Item.Error,
                            "unexpected right square bracket ']'"
                        );
                    }

                    if (lexer.depth === 1) {
                        if (lexer.next() === "]") {
                            --lexer.depth;
                            break loop;
                        }
                        lexer.backup();
                    }
                    break;
            }
        }

        lexer.emit(Item.SquareBracket);
        return lexSpace;
    }

    function lexBareword(lexer: Lexer<Item>): LexerState<Item> | null {
        const offset = lexer.source.slice(lexer.pos).search(/\s/);
        lexer.pos = offset === EOF ? lexer.source.length : lexer.pos + offset;
        lexer.emit(Item.Bareword);
        return offset === EOF ? null : lexSpace;
    }

    function lexJSObject(lexer: Lexer<Item>): LexerState<Item> | null {
        if (slurpBracket(lexer, "{") === EOF) {
            return lexer.error(Item.Error, "unterminated object");
        }

        lexer.emit(Item.Container);
        return lexSpace;
    }
}

// Adapted from `parseSquareBracketedMarkup` in `wikifier.js` from SugarCube
// by way of `arguments.ts` from Twee3-Language-Tools
namespace SquareBracketParsing {
    export enum Item {
        Error, // error
        DelimLTR, // '|' or '->'
        DelimRTL, // '<-'
        InnerMeta, // ']['
        ImageMeta, // '[img[', '[<img[', or '[>img['
        LinkMeta, // '[['
        Link, // link destination
        RightMeta, // ']]'
        Setter, // setter expression
        Source, // image source
        Text, // link text or image alt text
    }
    enum Delim {
        None, // no delimiter encountered
        LTR, // '|' or '->'
        RTL, // '<-'
    }

    // Lexing functions.
    function slurpQuote(lexer: Lexer<Item>, endQuote: string): EOFT | number {
        loop: for (;;) {
            switch (lexer.next()) {
                case "\\": {
                    const ch = lexer.next();

                    if (ch !== EOF && ch !== "\n") {
                        break;
                    }
                }
                /* falls through */
                case EOF:
                case "\n":
                    return EOF;

                case endQuote:
                    break loop;
            }
        }

        return lexer.pos;
    }

    export function lexLeftMeta(lexer: Lexer<Item>) {
        if (!lexer.accept("[")) {
            return lexer.error(Item.Error, "malformed square-bracketed markup");
        }

        // Is link markup.
        if (lexer.accept("[")) {
            lexer.data.isLink = true;
            lexer.emit(Item.LinkMeta);
        }

        // May be image markup.
        else {
            lexer.accept("<>"); // aligner syntax

            if (
                !lexer.accept("Ii") ||
                !lexer.accept("Mm") ||
                !lexer.accept("Gg") ||
                !lexer.accept("[")
            ) {
                return lexer.error(
                    Item.Error,
                    "malformed square-bracketed markup"
                );
            }

            lexer.data.isLink = false;
            lexer.emit(Item.ImageMeta);
        }

        lexer.depth = 2; // account for both initial left square brackets
        return lexCoreComponents;
    }

    function lexCoreComponents(lexer: Lexer<Item>) {
        const what = lexer.data.isLink ? "link" : "image";
        let delim = Delim.None;

        for (;;) {
            switch (lexer.next()) {
                case EOF:
                case "\n":
                    return lexer.error(
                        Item.Error,
                        `unterminated ${what} markup`
                    );

                case '"':
                    /*
						This is not entirely reliable within sections that allow raw strings, since
						it's possible, however unlikely, for a raw string to contain unpaired double
						quotes.  The likelihood is low enough, however, that I'm deeming the risk as
						acceptable—for now, at least.
					*/
                    if (slurpQuote(lexer, '"') === EOF) {
                        return lexer.error(
                            Item.Error,
                            `unterminated double quoted string in ${what} markup`
                        );
                    }
                    break;

                case "|": // possible pipe ('|') delimiter
                    if (delim === Delim.None) {
                        delim = Delim.LTR;
                        lexer.backup();
                        lexer.emit(Item.Text);
                        lexer.forward();
                        lexer.emit(Item.DelimLTR);
                        // lexer.ignore();
                    }
                    break;

                case "-": // possible right arrow ('->') delimiter
                    if (delim === Delim.None && lexer.peek() === ">") {
                        delim = Delim.LTR;
                        lexer.backup();
                        lexer.emit(Item.Text);
                        lexer.forward(2);
                        lexer.emit(Item.DelimLTR);
                        // lexer.ignore();
                    }
                    break;

                case "<": // possible left arrow ('<-') delimiter
                    if (delim === Delim.None && lexer.peek() === "-") {
                        delim = Delim.RTL;
                        lexer.backup();
                        lexer.emit(lexer.data.isLink ? Item.Link : Item.Source);
                        lexer.forward(2);
                        lexer.emit(Item.DelimRTL);
                        // lexer.ignore();
                    }
                    break;

                case "[":
                    ++lexer.depth;
                    break;

                case "]":
                    --lexer.depth;

                    if (lexer.depth === 1) {
                        switch (lexer.peek()) {
                            case "[":
                                ++lexer.depth;
                                lexer.backup();

                                if (delim === Delim.RTL) {
                                    lexer.emit(Item.Text);
                                } else {
                                    lexer.emit(
                                        lexer.data.isLink
                                            ? Item.Link
                                            : Item.Source
                                    );
                                }

                                lexer.forward(2);
                                lexer.emit(Item.InnerMeta);
                                // lexer.ignore();
                                return lexer.data.isLink
                                    ? lexSetter
                                    : lexImageLink;

                            case "]":
                                --lexer.depth;
                                lexer.backup();

                                if (delim === Delim.RTL) {
                                    lexer.emit(Item.Text);
                                } else {
                                    lexer.emit(
                                        lexer.data.isLink
                                            ? Item.Link
                                            : Item.Source
                                    );
                                }

                                lexer.forward(2);
                                lexer.emit(Item.RightMeta);
                                // lexer.ignore();
                                return null;

                            default:
                                return lexer.error(
                                    Item.Error,
                                    `malformed ${what} markup`
                                );
                        }
                    }
                    break;
            }
        }
    }

    function lexImageLink(lexer: Lexer<Item>) {
        const what = lexer.data.isLink ? "link" : "image";

        for (;;) {
            switch (lexer.next()) {
                case EOF:
                case "\n":
                    return lexer.error(
                        Item.Error,
                        `unterminated ${what} markup`
                    );

                case '"':
                    /*
						This is not entirely reliable within sections that allow raw strings, since
						it's possible, however unlikely, for a raw string to contain unpaired double
						quotes.  The likelihood is low enough, however, that I'm deeming the risk as
						acceptable—for now, at least.
					*/
                    if (slurpQuote(lexer, '"') === EOF) {
                        return lexer.error(
                            Item.Error,
                            `unterminated double quoted string in ${what} markup link component`
                        );
                    }
                    break;

                case "[":
                    ++lexer.depth;
                    break;

                case "]":
                    --lexer.depth;

                    if (lexer.depth === 1) {
                        switch (lexer.peek()) {
                            case "[":
                                ++lexer.depth;
                                lexer.backup();
                                lexer.emit(Item.Link);
                                lexer.forward(2);
                                lexer.emit(Item.InnerMeta);
                                // lexer.ignore();
                                return lexSetter;

                            case "]":
                                --lexer.depth;
                                lexer.backup();
                                lexer.emit(Item.Link);
                                lexer.forward(2);
                                lexer.emit(Item.RightMeta);
                                // lexer.ignore();
                                return null;

                            default:
                                return lexer.error(
                                    Item.Error,
                                    `malformed ${what} markup`
                                );
                        }
                    }
                    break;
            }
        }
    }

    function lexSetter(lexer: Lexer<Item>) {
        const what = lexer.data.isLink ? "link" : "image";

        for (;;) {
            switch (lexer.next()) {
                case EOF:
                case "\n":
                    return lexer.error(
                        Item.Error,
                        `unterminated ${what} markup`
                    );

                case '"':
                    if (slurpQuote(lexer, '"') === EOF) {
                        return lexer.error(
                            Item.Error,
                            `unterminated double quoted string in ${what} markup setter component`
                        );
                    }
                    break;

                case "'":
                    if (slurpQuote(lexer, "'") === EOF) {
                        return lexer.error(
                            Item.Error,
                            `unterminated single quoted string in ${what} markup setter component`
                        );
                    }
                    break;

                case "[":
                    ++lexer.depth;
                    break;

                case "]":
                    --lexer.depth;

                    if (lexer.depth === 1) {
                        if (lexer.peek() !== "]") {
                            return lexer.error(
                                Item.Error,
                                `malformed ${what} markup`
                            );
                        }

                        --lexer.depth;
                        lexer.backup();
                        lexer.emit(Item.Setter);
                        lexer.forward(2);
                        lexer.emit(Item.RightMeta);
                        // lexer.ignore();
                        return null;
                    }
                    break;
            }
        }
    }
}
