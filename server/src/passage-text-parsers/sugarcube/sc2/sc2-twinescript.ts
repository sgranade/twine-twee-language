import { TextDocument } from "vscode-languageserver-textdocument";

import { JSPropertyLabel, tokenizeJSExpression } from "../../../js-parser";
import { createLocationFor } from "../../../parser";
import { Label } from "../../../project-index";
import { capturePreSemanticTokenFor, StoryFormatParsingState } from "../..";

/**
 * Mapping of TwineScript sugaring to replacements.
 *
 * Adapted from SugarCube's `scripting.js`
 */
const desugarMap: { [key: string]: string } = {
    // We replace variable sigils with a letter so that later tokenizing works
    // properly
    // Story $variable sigil-prefix.
    $: "P",
    // Temporary _variable sigil-prefix.
    _: "T",
    // Assignment operator.
    to: "=",
    // Equality operators.
    eq: "==",
    neq: "!=",
    is: "===",
    isnot: "!==",
    // Relational operators.
    gt: ">",
    gte: ">=",
    lt: "<",
    lte: "<=",
    // Logical operators.
    and: "&&",
    or: "||",
    // Unary operators.
    not: "!",
    // `def` and `ndef` expand to multi-element expressions like `"undefined" !== typeof`.
    // Since we're only desugaring TwineScript to create semantic tokens, we'll fake the
    // funk and swap them out with a single unary operator so we get the right semantic token
    def: "!",
    ndef: "!",
};
/**
 * RegExp to find keys in the desugarMap
 */
const desugarRegExp = new RegExp(
    [
        "[$_](?=[A-Za-z$_])", // Variable sigils
        "\\b(?:to|n?eq|is(?:not)?|gte?|lte?|and|or|not|n?def)\\b", // Word operators
    ].join("|"),
    "g"
);

/**
 * Position mapping for position-preserving substitution.
 */
interface PositionMapping {
    originalStart: number;
    originalString: string; // Save the original string for undoing the substitution
    newStart: number;
    newEnd: number;
}

interface DesugarResult {
    desugared: string;
    positionMapping: PositionMapping[];
}

/**
 * Replace TwineScript syntactic sugar with its Javascript equivalents.
 *
 * Note that `def` and `ndef` aren't properly translated to
 * `"undefined" !== typeof` and `"undefined" === typeof`, variable
 * sigil `$` is replaced by `P` and `_` is replaced by `T`.
 *
 * @param str TwineScript string to desugar.
 * @returns The desugared string and mapping of old to new positions.
 */
export function desugar(str: string): DesugarResult {
    const result: DesugarResult = {
        desugared: "",
        positionMapping: [],
    };

    // Replace all sugar constructs with their JavaScript equivalent
    // using position-preserving substitution.
    let sliceStart = 0;
    let runningDelta = 0;
    desugarRegExp.lastIndex = 0;
    for (const m of str.matchAll(desugarRegExp)) {
        const replacement = desugarMap[m[0]] || "";
        result.desugared += str.slice(sliceStart, m.index) + replacement;
        result.positionMapping.push({
            originalStart: m.index,
            originalString: m[0],
            newStart: m.index + runningDelta,
            newEnd: m.index + runningDelta + replacement.length,
        });
        runningDelta += replacement.length - m[0].length;
        sliceStart = m.index + m[0].length;
    }
    result.desugared += str.slice(sliceStart);

    return result;
}

interface SugaredPositionAndText {
    /**
     * Position in a sugared string.
     */
    sugaredPosition: number;
    /**
     * The original sugared text at the desugared position, if any.
     */
    sugaredText?: string;
}

/**
 * Get the delta from desugared to sugared TwineScript string and original sugared text (if any).
 *
 * @param desugaredPosition Position in the desugared string.
 * @param positionMapping Position mapping from desugaring the TwineScript string.
 * @returns Delta from desugared to sugared position
 */
function getSugaredPositionAndNewText(
    desugaredPosition: number,
    positionMapping: PositionMapping[]
): SugaredPositionAndText {
    const ret: SugaredPositionAndText = {
        sugaredPosition: desugaredPosition,
    };

    // Find the position mapping right before the desugared position
    let ndx = positionMapping.findIndex((p) => desugaredPosition < p.newStart);
    if (ndx === -1) ndx = positionMapping.length;
    // Adjustments are only needed after the first position mapping
    if (ndx !== 0) {
        // The mapping we want is the one before the index
        const mapping = positionMapping[ndx - 1];

        // If the offsets match, then we're at a desugared value and need to
        // swap in the original sugared value
        if (desugaredPosition === mapping.newStart) {
            ret.sugaredText = mapping.originalString;
            ret.sugaredPosition += mapping.originalStart - mapping.newStart;
        } else {
            ret.sugaredPosition +=
                mapping.originalStart +
                mapping.originalString.length -
                mapping.newEnd;
        }
    }

    return ret;
}

/**
 * Tokenize a TwineScript expression and find referenced variables and properties in it.
 *
 * Returned properties are only those for which the parser could trace their "ownership"
 * back to a root variable.
 *
 * @param expression Expression to parse.
 * @param offset Offset into the document where the expression occurs.
 * @param state Parsing state.
 * @param storyFormatState Passage state object that will collect tokens.
 * @returns Two-tuple with separate lists of variable and property labels found in parsing.
 */
export function tokenizeTwineScriptExpression(
    expression: string,
    offset: number,
    textDocument: TextDocument,
    storyFormatState: StoryFormatParsingState
): [Label[], JSPropertyLabel[]] {
    const { desugared, positionMapping } = desugar(expression);

    // Turning TwineScript into JavaScript changes positions within a string.
    // We have to translate the positions of Javascript variable and property labels,
    // as well as semantic tokens, into positions relative to the original TwineScript
    // expression. As part of that, we'll stash the JavaScript semantic tokens in
    // a temporary story format parsing state.
    const desugaredStoryFormatState: StoryFormatParsingState = {
        passageTokens: {},
    };
    // We'll also create a fake document that contains just the expression
    const desugaredDocument = TextDocument.create(
        "fake-uri",
        "javascript",
        1,
        desugared
    );

    const [vars, props] = tokenizeJSExpression(
        desugared,
        0, // offset of 0 since the desugared expression starts at the start of the doc
        desugaredDocument,
        desugaredStoryFormatState
    );

    // Adjust variable and property locations and (if needed) text
    const seenUnsugaredVars: Record<string, string> = {};
    for (const v of [...vars, ...props]) {
        const desugaredOffset = desugaredDocument.offsetAt(
            v.location.range.start
        );

        const { sugaredPosition, sugaredText } = getSugaredPositionAndNewText(
            desugaredOffset,
            positionMapping
        );

        // Variable sigils need to replace the first part of the existing string
        if (sugaredText === "$" || sugaredText === "_") {
            // Save the unsugared variable name and its replacement in seenVars
            const unsugaredVar = v.contents;
            v.contents = sugaredText + v.contents.slice(1);
            seenUnsugaredVars[unsugaredVar] = v.contents;
        } else if (sugaredText !== undefined) {
            v.contents = sugaredText;
        }

        // If we have a property, we need to replace the desugared variable
        // with its sugared value
        if (JSPropertyLabel.is(v) && v.scope !== undefined) {
            const rootVar = v.scope.split(".")[0];
            const sugaredVar = seenUnsugaredVars[rootVar];
            if (sugaredVar !== undefined) {
                v.scope = v.scope.replace(rootVar, sugaredVar);
            }
        }

        v.location = createLocationFor(
            v.contents,
            offset + sugaredPosition,
            textDocument
        );
    }

    // Adjust semantic token locations and (if needed) text
    for (const t of Object.values(desugaredStoryFormatState.passageTokens)) {
        const { sugaredPosition, sugaredText } = getSugaredPositionAndNewText(
            t.at,
            positionMapping
        );

        // Variable sigils need to replace the first part of the existing string
        if (sugaredText === "$" || sugaredText === "_") {
            t.text = sugaredText + t.text.slice(1);
        } else if (sugaredText !== undefined) t.text = sugaredText;

        capturePreSemanticTokenFor(
            t.text,
            offset + sugaredPosition,
            t.type,
            t.modifiers,
            storyFormatState
        );
    }

    return [vars, props];
}
