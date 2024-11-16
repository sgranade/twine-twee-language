# Twine (Twee 3) Language

A VS Code extension for [Twine] (specifically the [Twee3] format) and the [Chapbook] and [SugarCube] story formats.

## Features

### Twee

-   Autocomplete (Twine links, `StoryData` contents, CSS stylesheets, HTML)
-   Syntax highlighting
-   Error highlighting
-   Go to passage definition
-   Highlight references to passages in links
-   Compile your story to a releasable HTML file.

### Chapbook

-   Autocomplete
-   Syntax highlighting
-   Error highlighting
-   Highlight variable references
-   Support for inserts and modifiers
    -   Autocomplete (both names and arguments)
    -   Hover information
    -   Argument validation
    -   Support for custom inserts and modifiers (requires [extra information][custom chapbook functions])
        -   Find everywhere the custom insert/modifier is used
        -   Go to the custom insert/modifier's definition
        -   Argument validation

### SugarCube

-   Autocomplete
-   Syntax highlighting
-   Error highlighting
-   Highlight variable references
-   Support for macros
    -   Autocomplete (names only)
    -   Hover information
    -   Highlight references to macros
    -   Support for custom macros (uses the [T3LT custom macro format])

## Installation

[Install from the VSCode extension marketplace][marketplace].

## Getting Started

Open the folder with your game and the extension will index all files that end in `.tw` or `.twee` that are in the story's source directory (default: `src`).

The extension determines what story format to use based on the `format` property in your `StoryData` passage.

## Building Your Story

The extension can turn your story into a playable file. It bundles all files in the source directory (default: `src`), combines them with the appropriate story format in the story formats directory (default: `.storyformats`), and creates an `.html` file in the build directory (default: `build`). The extension bundles all files [supported by Tweego][Tweego files] except for `.tw2`, `.twee2`, `.htm`, and `.html`.

There are two ways you can build your story. One, the extension includes two commands to build the story. Open the [command palette] and begin typing `Twine`. The palette will list all commands provided by the extension. Select either `Build Game` or `Build Game (test mode)` to build your game.

![Build Game Commands](https://raw.githubusercontent.com/sgranade/twine-twee-language/main/images/twine-extension-commands.png)

Two, the extension also provides native VS Code tasks so that you can build the story using the `Ctrl+Shift+B` shortcut. Open the comand palette and select the `Run Tasks` command. In the list of task folder that appears, select the `Twine` folder. Then select either `twine: Build` or `twine: Build (test mode)`. When it asks you what kind of errors or warnings to scan for, select `Continue without scanning the build output`.

![Build Game Tasks](https://raw.githubusercontent.com/sgranade/twine-twee-language/main/images/twine-extension-tasks.png)

You'll need a local copy of the story format in the story formats directory. The extension will try to automatically download the format if it's Chapbook or SugarCube. If that fails, or if you're using a different story format, you can add it yourself. Download the story format you want to use. In the story formats directory, create a directory for the story format named `formatname-x-y-z`, where `formatname` is the lowercase name of the story format (like `chapbook` or `sugarcube`) and `x-y-z` is the version number separated by dashes instead of dots. In that directory, put the `format.js` file that you downloaded.

[Chapbook]: https://klembot.github.io/chapbook/
[command palette]: https://code.visualstudio.com/docs/getstarted/userinterface#_command-palette
[custom chapbook functions]: docs/chapbook-custom-inserts-modifiers.md
[marketplace]: https://marketplace.visualstudio.com/items?itemName=StephenGranade.twine-twee-language
[SugarCube]: https://www.motoslave.net/sugarcube/2/
[Twee3]: https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
[Tweego files]: http://www.motoslave.net/tweego/docs/#usage-supported-files
[Twee 3 Language Tools]: https://github.com/cyrusfirheir/twee3-language-tools/
[T3LT custom macro format]: https://github.com/cyrusfirheir/twee3-language-tools/?tab=readme-ov-file#custom-macro-definitions-for-sugarcube
[Twine]: https://twinery.org/
