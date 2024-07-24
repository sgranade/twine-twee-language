# Twine (Twee 3)

A VS Code plugin for [Twine] (specifically the [Twee3] format) and the [Chapbook] story format.

## Features

### Twee

-   Autocomplete (Twine links, `StoryData` contents, CSS stylesheets)
-   Syntax highlighting
-   Error highlighting
-   Go to passage definition
-   Highlight references to passages in links

### Chapbook

-   Syntax highlighting
-   Error highlighting
-   Support for inserts and modifiers
    -   Autocomplete (both names and arguments)
    -   Hover information
    -   Go to a custom inserts or modifier's definition
    -   Highlight references to a custom insert or modifier

The plugin recognizes [custom inserts] and [modifiers][custom modifiers] defined through `engine.extend()` calls. You can add additional properties to your custom insert or modifier to add better autocomplete and hover support.

-   `name` (string): The custom insert/modifier's name.
-   `syntax` (string): What the author will type to use your custom insert/modifier, such as "[custom modifier]" or "{new insert: 'text to display'}". Shown when hovering over the insert/modifier.
-   `description` (string): What your custom insert/modifier does. Shown when hovering over it.
-   `completions` (array of strings): The text to be used when VS Code tries to auto-complete your insert/modifier. For example, the `[if]` and `[else]` modifier's completions are `['if', 'else']`.

Here's how the example custom insert from the Chapbook documentation could use these properties.

```
[JavaScript]
engine.extend("2.0.0", () => {
    engine.template.inserts.add({
        name: "smiley face",
        syntax: "{smiley face}",
        description: "Inserts a smiley face emoji.",
        match: /^smiley face$/i,
        completions: ["smiley face"],
        render: () => "😀",
    });
});
```

## Installation

[Install from the VSCode extension marketplace][marketplace].

## Getting Started

Open the folder with your game and the plugin will index all files that end in `.tw` or `.twee`.

The plugin determines what story format to use based on the `format` property in your `StoryData` passage.

[Chapbook]: https://klembot.github.io/chapbook/
[custom inserts]: https://klembot.github.io/chapbook/guide/advanced/adding-custom-inserts.html
[custom modifiers]: https://klembot.github.io/chapbook/guide/advanced/adding-custom-modifiers.html
[marketplace]: https://marketplace.visualstudio.com/
[Twee3]: https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
[Twine]: https://twinery.org/
