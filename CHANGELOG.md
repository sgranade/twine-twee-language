# Change Log

Changes to the extension.

## [1.1.4] - 2025 06 25

### Added

- Chapbook: Variable section contents are now decorated in the editor to make them more visually distinctive when editing them.

### Fixed

- Properly loads local images When running games. (issue #5)
- Chapbook: Modifier completions now work as expected when the cursor is at a semicolon.
- SugarCube: Now properly recognizes the `<<repeat>>` macro. (issue #6)
- SugarCube: Warns if `<<do>>` macro is used before SugarCube 2.37.0.

## [1.1.3] - 2025 03 18

A collection of Chapbook enhancements/fixes, as well as bringing SugarCube support up to parity with [twee3-language-tools](https://github.com/cyrusfirheir/twee3-language-tools/) v0.32.0.

### Changed

- Chapbook: Insert completions aren't suggested after `{` in Javascript-modified sections.
- Chapbook: Variables are no longer auto-suggested in strings inside the vars section.
- SugarCube: Whitespace is now accepted after a `|` macro parameter variant. (twee3-language-tools issue [#176](https://github.com/cyrusfirheir/twee3-language-tools/issues/176))

### Fixed

- Build system can now build games whose source code is at the root level of the project.
- Fixed bug that caused issues if any files had no extension.
- Chapbook and SugarCube now properly handle `[script]` passages.
- Chapbook: Variables that start with `$` or `_` are now properly parsed.
- Chapbook: Removed spurious errors for a range of variable names when set in the vars section.
- Chapbook: `random.d4` and similar are no longer flagged as unrecognized variables.

## [1.1.2] - 2025 01 12

### Changed

- Reworked parsing routines to improve performance on large projects.

### Fixed

- Source code at the root level of a project is now indexed properly.
- SugarCube: Lexing errors are now logged against the correct text.
- SugarCube: Macros like `<<link>>` that accept link markup no longer cause spurious errors.
- SugarCube: Macros like `<<for>>` that take array or object containers are now parsed properly.
- SugarCube: `<<case>>` macros now accept `undefined` as a value.

## [1.1.1] - 2024 12 21

### Added

- Chapbook: Added folding ranges for modifiers.
- Chapbook: Modifier contents are now decorated in the editor to make them more visually distinctive when editing them.

### Changed

- Chapbook: Variable and property auto-completions now only include variables and properties set in a vars section.
- Chapbook: Modifiers now have a different syntax highlighting color than inserts so they're easier to distinguish.

### Fixed

- "Indexing Twine Project..." status bar item no longer hides the "Run Twine Game" item when the former appears.
- Chapbook: Fixed bug where renaming variables and properties didn't rename all variables or properties.
- Chapbook: Completions for modifiers after a semicolon no longer have an extra space.

## [1.1.0] - 2024 12 01

### Added

- The extension now shows on the status bar when the project is being indexed.
- SugarCube: Widgets defined by the `<<widget>>` macro are now parsed and recognized as macros.
- SugarCube: The `data-passage` and `data-setter` [special HTML attributes](http://www.motoslave.net/sugarcube/2/docs/#markup-html-svg-attribute-special) are now parsed.
- SugarCube: [Attribute directives](http://www.motoslave.net/sugarcube/2/docs/#markup-html-svg-attribute-directive) are now parsed.
- SugarCube: [Custom styles](https://www.motoslave.net/sugarcube/2/docs/#markup-custom-style) are now parsed.

### Changed

- SugarCube: Passages with `<<widget>>` macros now give a warning if they don't have a `widget` tag.
- SugarCube: Receiver values (like those to the `<<checkbox>>` macro) are now warned as an error if they're not a string or back-ticked expression.
- SugarCube: Parsing re-worked to speed up indexing large projects.

### Fixed

- Chapbook: Fixed bug where inserts with `{` inside quotation marks weren't parsed properly.
- SugarCube: Macros and variables are no longer parsed inside verbatim HTML markup.
- SugarCube: Comment blocks in passages are now properly ignored.
- SugarCube: `<<elseif>>` after an `<<else>>` is now flagged as an error.

## [1.0.0] - 2024 11 23

You can now run built Twine games natively in VS Code.

### Added

- You can run built Twine games directly within VS Code.
- Build system: Live reload or restart a running game on a successful build.
- Build system: You can now include files without bundling them into the `.html` file.
- Build system: New `Watch` task continuously builds the story whenever source code is changed.

### Fixed

- Chapbook: Custom inserts with defined completions are no longer listed twice in the completions list.

## [0.2.0] - 2024 11 15

The extension has a new build system to turn your games into playable `.html` files.

### Added

- New build system.
    - Compiles games into playable `.html` files.
    - Automatically downloads local copies of the story format (Chapbook and SugarCube only).

### Fixed

- Language server now correctly indexes files that have been edited but not saved.

## [0.1.2] - 2024 11 07

More updated support for SugarCube.

### Added

- SugarCube: Arguments to macros like `<<set>>` that take expressions are now fully parsed.
- SugarCube: Expressions that contain backquotes are now fully parsed.

## [0.1.1] - 2024 11 05

Updated support for SugarCube.

### Added

- SugarCube: TwineScript parsing in wiki link markup such as `[Go back->previous()]`.
- SugarCube: JavaScript/TwineScript parsing in `<<script>>` macros.
- SugarCube: CSS parsing in `<style>` tags.
- SugarCube: additional macro argument parsing.

## [0.1.0] - 2024 11 01

Initial release.
