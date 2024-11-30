# Change Log

Changes to the extension.

## Unreleased

### Added

-   SugarCube: Widgets defined by the `<<widget>>` macro are now parsed and recognized as macros.
-   SugarCube: Passages with `<<widget>>` macros now give a warning if they don't have a `widget` tag.
-   SugarCube: The `data-passage` and `data-setter` [special HTML attributes ](http://www.motoslave.net/sugarcube/2/docs/#markup-html-svg-attribute-special) are now parsed.
-   SugarCube: [Attribute directives](http://www.motoslave.net/sugarcube/2/docs/#markup-html-svg-attribute-directive) are now parsed.
-   SugarCube [Custom styles](https://www.motoslave.net/sugarcube/2/docs/#markup-custom-style) are now parsed.
-   SugarCube: `<<elseif>>` after an `<<else>>` is now flagged as an error.
-   SugarCube: Receiver values (like those to the `<<checkbox>>` macro) are now warned as an error if they're not a string or back-ticked expression.

### Fixed

-   Chapbook: Fixed bug where inserts with `{` inside quotation marks weren't parsed properly.
-   SugarCube: Macros and variables are no longer parsed inside verbatim HTML markup.
-   SugarCube: Comment blocks in passages are now properly ignored.

## [1.0.0] - 2024 11 23

You can now run built Twine games natively in VS Code.

### Added

-   You can run built Twine games directly within VS Code.
-   Build system: Live reload or restart a running game on a successful build.
-   Build system: You can now include files without bundling them into the `.html` file.
-   Build system: New `Watch` task continuously builds the story whenever source code is changed.

### Fixed

-   Chapbook: Custom inserts with defined completions are no longer listed twice in the completions list.

## [0.2.0] - 2024 11 15

The extension has a new build system to turn your games into playable `.html` files.

### Added

-   New build system.
    -   Compiles games into playable `.html` files.
    -   Automatically downloads local copies of the story format (Chapbook and SugarCube only).

### Fixed

-   Language server now correctly indexes files that have been edited but not saved.

## [0.1.2] - 2024 11 07

More updated support for SugarCube.

### Added

-   SugarCube: Arguments to macros like `<<set>>` that take expressions are now fully parsed.
-   SugarCube: Expressions that contain backquotes are now fully parsed.

## [0.1.1] - 2024 11 05

Updated support for SugarCube.

### Added

-   SugarCube: TwineScript parsing in wiki link markup such as `[Go back->previous()]`.
-   SugarCube: JavaScript/TwineScript parsing in `<<script>>` macros.
-   SugarCube: CSS parsing in `<style>` tags.
-   SugarCube: additional macro argument parsing.

## [0.1.0] - 2024 11 01

Initial release.
