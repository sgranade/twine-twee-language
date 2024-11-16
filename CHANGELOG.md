# Change Log

Changes to the extension.

## [0.2.0] - 2024 11 15

### Added

-   New build system.
    -   Compiles games into playable `.html` files.
    -   Automatically downloads local copies of the story format (Chapbook and SugarCube only).

### Fixed

-   Language server now correctly indexes files that have been edited but not saved.

## [0.1.2] - 2024 11 07

### Added

-   SugarCube: Arguments to macros like `<<set>>` that take expressions are now fully parsed.
-   SugarCube: Expressions that contain backquotes are now fully parsed.

## [0.1.1] - 2024 11 05

### Added

-   SugarCube: TwineScript parsing in wiki link markup such as `[Go back->previous()]`.
-   SugarCube: JavaScript/TwineScript parsing in `<<script>>` macros.
-   SugarCube: CSS parsing in `<style>` tags.
-   SugarCube: additional macro argument parsing.

## [0.1.0] - 2024 11 01

Initial release.
