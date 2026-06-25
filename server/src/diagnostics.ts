import { DiagnosticSeverity, Diagnostic, Range } from "vscode-languageserver";
import type { TextDocument } from "vscode-languageserver-textdocument";

/**
 * Metadata for diagnostic.
 */
interface DiagnosticMetadata {
    /**
     * Diagnostic message.
     */
    message: string;
    /**
     * Diagnostic severity. If omitted, `DiagnosticSeverity.Error` is used.
     */
    severity?: DiagnosticSeverity;
}

/**
 * Twine diagnostic codes.
 */
export const DiagnosticCodes = {
    IncorrectJavaScript: "incorrect-javascript",
    IncorrectPassageMetadataFormat: "incorrect-passage-metadata-format",
    IncorrectPassageTagFormat: "incorrect-passage-tag-format",
    MissingCloseParen: "missing-close-paren",
    MissingPassage: "missing-passage",
    MultiplePassageDefinitions: "multiple-passage-definitions",
    PassageHeaderTextAfterMetadata: "passage-header-text-after-metadata",
    PassageHeaderTextAfterTags: "passage-header-text-after-tags",
    PassageNameWithClosingCharacter: "passage-name-with-closing-character",
    PassageTagsAfterMetadata: "passage-tags-after-metadata",
    ReplacesStoryData: "replaces-story-data",
    ReplacesStoryTitle: "replaces-story-title",
    VariableNeverSet: "variable-never-set",
    // Chapbook
    ChapbookBadArgument: "bad-argument",
    ChapbookFunctionMissingFirstArgument: "function-missing-first-argument",
    ChapbookFunctionNotAvailable: "function-not-available",
    ChapbookFunctionWillIgnoreFirstArgument:
        "function-will-ignore-first-argument",
    ChapbookIgnoredText: "ignored-text",
    ChapbookIncorrectCompletions: "incorrect-completions",
    ChapbookNonNumericEngineExtensionVersion:
        "non-numeric-engine-extension-version",
    ChapbookInsertIgnoredProperty: "insert-ignored-property",
    ChapbookInsertMissingProperties: "insert-missing-properties",
    ChapbookMatchIsNotRegex: "match-is-not-regex",
    ChapbookMissingColon: "missing-colon",
    ChapbookNoArrayDeferencingMidExpression:
        "no-array-dereferencing-mid-expression",
    ChapbookNoSpacesAfterModifiers: "no-spaces-after-modifiers",
    ChapbookNoSpacesBeforeModifiers: "no-spaces-before-modifiers",
    ChapbookNoSpacesInCustomInsertMatch: "no-spaces-in-custom-insert-match",
    ChapbookNoSpacesInInsertProperty: "no-spaces-in-insert-properties",
    ChapbookNoSpacesInVariableNames: "no-spaces-in-variable-names",
    ChapbookNotPassageStringOrVariable: "not-passage-string-or-variable",
    ChapbookPropertyIsNotString: "property-is-not-string",
    ChapbookRevealLinkIgnorePassageProperty:
        "reveal-link-ignore-passage-property",
    ChapbookRevealLinkMissingProperty: "reveal-link-missing-property",
    ChapbookStoryFormatVersionMismatch: "story-format-versio-mismatch",
    ChapbookUnknownEngineTemplateFunction: "unknown-engine-template-function",
    ChapbookUnknownInsert: "unknown-insert",
    ChapbookUnknownModifier: "unknown-modifier",
    // SugarCube
    SugarCubeDeprecatedSpecialPassage: "deprecated-special-passage",
    SugarCubeDeprecatedTag: "deprecated-tag",
    SugarCubeEitherDataPassageOrHref: "either-data-passage-or-href",
    SugarCubeElseIfAfterElse: "elseif-after-else",
    SugarCubeEndmacroDeprecated: "endmacro-deprecated",
    SugarCubeExpectedArguments: "expected-arguments",
    SugarCubeExpectedNoArguments: "expected-no-arguments",
    SugarCubeIncorrectRangeSyntax: "incorrect-range-syntax",
    SugarCubeIncorrectTwineLink: "incorrect-twine-link",
    SugarCubeInvalidMacroArguments: "invalid-macro-arguments",
    SugarCubeLinkSetterIgnoresMacros: "link-setter-ignores-macros",
    SugarCubeMacroArgumentParsingError: "macro-argument-parsing-error",
    SugarCubeMacroArgumentWarning: "macro-argument-warning",
    SugarCubeMacroFileError: "macro-file-error",
    SugarCubeMacroHasNoClosingMacro: "macro-has-no-closing-macro",
    SugarCubeMacroNotAvailable: "macro-not-available",
    SugarCubeMacroRemoved: "macro-removed",
    SugarCubeMissingCloseMacro: "missing-close-macro",
    SugarCubeMissingOpenMacro: "missing-open-macro",
    SugarCubeMissingParentMacro: "missing-parent-macro",
    SugarCubeMissingWidgetTag: "missing-widget-tag",
    SugarCubeNoEvaluationDirective: "no-evaluation-directive",
    SugarCubeNoForInOf: "no-for-in-of",
    SugarCubeNoMultipleMediaPassageTags: "no-multiple-media-passage-tags",
    SugarCubeNoMultipleWidgetDefinitions: "no-multiple-widget-definitions",
    SugarCubeNoWidgetWithBuiltInMacroName: "no-widget-with-built-in-macro-name",
    SugarCubeTooManyChildMacros: "too-many-child-macros",
    SugarCubeUnsupporedMediaPassageTags: "unsupported-media-passage-tags",
    SugarCubeUnsupporedSpecialPassage: "unsupported-special-passage",
    SugarCubeUnexpectedBareVariable: "unexpected-bare-variable",
    SugarCubeUnexpectedWidgetVariable: "unexpected-widget-variable",
    SugarCubeUnknownMacro: "unknown-macro",
    SugarCubeVariableNeverSet: "sugarcube-variable-never-set",
} as const;

export type DiagnosticCode =
    (typeof DiagnosticCodes)[keyof typeof DiagnosticCodes];

const DiagnosticMetadata: Record<DiagnosticCode, DiagnosticMetadata> = {
    [DiagnosticCodes.IncorrectJavaScript]: {
        message: "Incorrect JavaScript.",
    },
    [DiagnosticCodes.IncorrectPassageMetadataFormat]: {
        message: "Metadata isn't formatted correctly. Are you missing a '}'?",
    },
    [DiagnosticCodes.IncorrectPassageTagFormat]: {
        message: "Tags aren't formatted correctly. Are you missing a ']'?",
    },
    [DiagnosticCodes.MissingCloseParen]: {
        message: "Missing a close parenthesis",
    },
    [DiagnosticCodes.MissingPassage]: {
        message: "Cannot find this passage",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.MultiplePassageDefinitions]: {
        message: "This passage was defined elsewhere",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.PassageHeaderTextAfterMetadata]: {
        message: "Passage headers can't have text after metadata",
    },
    [DiagnosticCodes.PassageHeaderTextAfterTags]: {
        message: "Passage headers can't have text after tags",
    },
    [DiagnosticCodes.PassageNameWithClosingCharacter]: {
        message:
            "Passage names can't include } or ] without a \\ in front of it.",
    },
    [DiagnosticCodes.PassageTagsAfterMetadata]: {
        message: "Tags need to come before metadata.",
    },
    [DiagnosticCodes.ReplacesStoryData]: {
        message: "This replaces existing StoryData. Is that intentional?",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ReplacesStoryTitle]: {
        message: "This replaces an existing StoryTitle. Is that intentional?",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.VariableNeverSet]: {
        message:
            "This isn't set in any JavaScript section; make sure it's spelled correctly",
        severity: DiagnosticSeverity.Warning,
    },
    // Chapbook
    [DiagnosticCodes.ChapbookBadArgument]: {
        message: "Bad argument to a custom insert/modifier",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookFunctionMissingFirstArgument]: {
        message: "Requires a first argument",
    },
    [DiagnosticCodes.ChapbookFunctionNotAvailable]: {
        message: "This isn't available in this version of Chapbook",
    },
    [DiagnosticCodes.ChapbookFunctionWillIgnoreFirstArgument]: {
        message: "Will ignore this first argument",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookIgnoredText]: {
        message: "This will be ignored",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookIncorrectCompletions]: {
        message: "Completions must be a string or an array of strings",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookNonNumericEngineExtensionVersion]: {
        message: "The extension's version must be a number like '2.0.0'",
    },
    [DiagnosticCodes.ChapbookInsertIgnoredProperty]: {
        message: "Insert will ignore this property",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookInsertMissingProperties]: {
        message: "Missing expected properties",
    },
    [DiagnosticCodes.ChapbookMatchIsNotRegex]: {
        message: "Must be a regular expression",
    },
    [DiagnosticCodes.ChapbookMissingColon]: {
        message: "Missing colon; this line will be ignored",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookNoArrayDeferencingMidExpression]: {
        message:
            "Array dereferencing can only be at the end (that is, myVar[2] is okay but myVar[2].color isn't)",
    },
    [DiagnosticCodes.ChapbookNoSpacesAfterModifiers]: {
        message: "Modifiers can't have spaces after them",
    },
    [DiagnosticCodes.ChapbookNoSpacesBeforeModifiers]: {
        message: "Modifiers can't have spaces before them",
    },
    [DiagnosticCodes.ChapbookNoSpacesInCustomInsertMatch]: {
        message: "Custom inserts must have a space in their match",
    },
    [DiagnosticCodes.ChapbookNoSpacesInInsertProperty]: {
        message: "Properties can't have spaces",
    },
    [DiagnosticCodes.ChapbookNoSpacesInVariableNames]: {
        message: "Variable names can't have spaces",
    },
    [DiagnosticCodes.ChapbookNotPassageStringOrVariable]: {
        message:
            "Must be a string or variable containing a passage name or a variable",
    },
    [DiagnosticCodes.ChapbookPropertyIsNotString]: {
        message: "Must be a string",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookRevealLinkIgnorePassageProperty]: {
        message: 'The "passage" property will be ignored',
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookRevealLinkMissingProperty]: {
        message: 'Either the "passage" or "text" property must be defined',
    },
    [DiagnosticCodes.ChapbookStoryFormatVersionMismatch]: {
        message: "Story format version doesn't match what's needed",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookUnknownEngineTemplateFunction]: {
        message: "Unrecognized engine template function",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookUnknownInsert]: {
        message: "Unrecognized insert",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.ChapbookUnknownModifier]: {
        message: "Unrecognized modifier",
        severity: DiagnosticSeverity.Warning,
    },
    // SugarCube
    [DiagnosticCodes.SugarCubeDeprecatedSpecialPassage]: {
        message:
            "This special passage is deprecated in this version of SugarCube",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeDeprecatedTag]: {
        message: "This tag is deprecated in this version of SugarCube",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeEitherDataPassageOrHref]: {
        message: `Both "data-passage" and "href" attributes aren't allowed`,
    },
    [DiagnosticCodes.SugarCubeElseIfAfterElse]: {
        message: "<<elseif>> can't come after an <<else>>",
    },
    [DiagnosticCodes.SugarCubeEndmacroDeprecated]: {
        message: "<<endmacro>> is deprecated; use <</macro>> instead",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeExpectedArguments]: {
        message: "Expected arguments",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeExpectedNoArguments]: {
        message: "Expected no arguments",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeIncorrectRangeSyntax]: {
        message: "Range format syntax is `[[index,] value] range collection`",
    },
    [DiagnosticCodes.SugarCubeIncorrectTwineLink]: {
        message: "Incorrect Twine link format",
    },
    [DiagnosticCodes.SugarCubeInvalidMacroArguments]: {
        message: "Invalid macro arguments",
    },
    [DiagnosticCodes.SugarCubeLinkSetterIgnoresMacros]: {
        message: "Macros aren't evaluated inside link setters",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeMacroArgumentParsingError]: {
        message: "Unknown macro argument parsing error",
    },
    [DiagnosticCodes.SugarCubeMacroFileError]: {
        message: "The T3LT macro configuration file has errors",
    },
    [DiagnosticCodes.SugarCubeMacroArgumentWarning]: {
        message: "Potentially invalid macro arguments",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeMacroHasNoClosingMacro]: {
        message:
            "This macro isn't a container and so doesn't have a closing macro",
    },
    [DiagnosticCodes.SugarCubeMacroNotAvailable]: {
        message:
            "This macro isn't available until a later version of SugarCube",
    },
    [DiagnosticCodes.SugarCubeMacroRemoved]: {
        message:
            "This macro was removed and isn't availabe in this version of SugarCube",
    },
    [DiagnosticCodes.SugarCubeMissingCloseMacro]: {
        message: "Matching close macro not found",
    },
    [DiagnosticCodes.SugarCubeMissingOpenMacro]: {
        message: "Matching open macro not found",
    },
    [DiagnosticCodes.SugarCubeMissingParentMacro]: {
        message: "This macro must be inside a specific parent macro",
    },
    [DiagnosticCodes.SugarCubeMissingWidgetTag]: {
        message: `This passage contains <<widget>> macros, so needs a "widget" passage tag`,
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeNoEvaluationDirective]: {
        message: `"data-setter" can't have an evaluation directive`,
    },
    [DiagnosticCodes.SugarCubeNoForInOf]: {
        message:
            "`for...in` and `for...of` syntax aren't supported; try `for...range`",
    },
    [DiagnosticCodes.SugarCubeNoMultipleMediaPassageTags]: {
        message: "Multiple media passage tags aren't allowed",
    },
    [DiagnosticCodes.SugarCubeNoMultipleWidgetDefinitions]: {
        message: "Widgets can't be defined more than once",
    },
    [DiagnosticCodes.SugarCubeNoWidgetWithBuiltInMacroName]: {
        message: "Widgets can't have the same name as a built-in macro",
    },
    [DiagnosticCodes.SugarCubeTooManyChildMacros]: {
        message: "Parent macro can't have this many of this child macro",
    },
    [DiagnosticCodes.SugarCubeUnsupporedMediaPassageTags]: {
        message: "Unsupported in this version of SugarCube",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeUnsupporedSpecialPassage]: {
        message:
            "This special passage isn't supported in this version of SugarCube",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeUnexpectedBareVariable]: {
        message: "Non-string receivers are okay, but are often a mistake",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeUnexpectedWidgetVariable]: {
        message:
            "This variable name typically only exists inside <<widget>> macros; consider renaming it",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeUnknownMacro]: {
        message: "Unrecognized macro",
        severity: DiagnosticSeverity.Warning,
    },
    [DiagnosticCodes.SugarCubeVariableNeverSet]: {
        message:
            "This isn't set in any <<set>> macro, setter link, or JavaScript section; make sure it's spelled correctly",
        severity: DiagnosticSeverity.Warning,
    },
};

/**
 * Create a diagnostic message.
 *
 * Pass start and end locations as 0-based indexes into the document's text.
 *
 * @param code Code for the diagnostic.
 * @param start Start location in the text of the diagnostic message.
 * @param end End location in the text of the diagnostic message.
 * @param textDocument Document to which the diagnostic applies.
 * @param message Diagnostic message to override the default message associated with the code.
 */
export function createDiagnostic(
    code: DiagnosticCode,
    start: number,
    end: number,
    textDocument: TextDocument,
    message?: string,
): Diagnostic {
    const diagnostic: Diagnostic = {
        code: code,
        severity: DiagnosticMetadata[code].severity ?? DiagnosticSeverity.Error,
        range: {
            start: textDocument.positionAt(start),
            end: textDocument.positionAt(end),
        },
        message: message ?? DiagnosticMetadata[code].message,
        source: "Twine",
    };

    return diagnostic;
}

/**
 * Create a diagnostic message for a range.
 *
 * @param code Code for the diagnostic.
 * @param range Range to which the diagnostic applies.
 * @param message Diagnostic message to override the default message associated with the code.
 */
export function createDiagnosticFromRange(
    code: DiagnosticCode,
    range: Range,
    message?: string,
): Diagnostic {
    const diagnostic: Diagnostic = {
        code: code,
        severity: DiagnosticMetadata[code].severity ?? DiagnosticSeverity.Error,
        range: range,
        message: message ?? DiagnosticMetadata[code].message,
        source: "Twine",
    };

    return diagnostic;
}

/**
 * Generate a diagnostic for a given piece of text.
 *
 * Pass the text's location as a 0-based index into the document's text.
 *
 * @param code Diagnostic code.
 * @param text Text to generate the diagnostic message about.
 * @param at Location in the document of the text.
 * @param textDocument Document to which the diagnostic applies.
 * @param message Diagnostic message to override the default message associated with the code.
 * @returns
 */
export function createDiagnosticFor(
    code: DiagnosticCode,
    text: string,
    at: number,
    textDocument: TextDocument,
    message?: string,
): Diagnostic {
    return createDiagnostic(code, at, at + text.length, textDocument, message);
}
