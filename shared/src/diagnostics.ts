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
    UnrecognizedDiagnosticCode: "unrecognized-diagnostic-code",
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

export type DiagnosticMap<T> = Partial<Record<DiagnosticCode, T>>;

export const DisableDiagnosticTag = "tt3-disable";

// A set of the codes for quick lookup
export const diagnosticCodeSet = new Set(Object.values(DiagnosticCodes));

/**
 * Does a string correspond to a diagnostic code?
 * @param code String to check.
 * @returns True if the string corresponds to a diagnostic code.
 */
export function isDiagnosticCode(code: string): code is DiagnosticCode {
    return diagnosticCodeSet.has(code as DiagnosticCode);
}
