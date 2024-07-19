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

The plugin recognizes [custom inserts] and [modifiers] defined through `engine.extend()` calls. If you add a `name` property to your custom insert or modifier, the plugin will use that name in auto-completions. If you add a `description` property, the plugin will show its value when hovering over the insert or modifier. For instance, here's how you could add both to the example custom insert from the Chapbook documentation.

```
[JavaScript]
engine.extend("2.0.0", () => {
    engine.timplate.inserts.add({
        name: "smiley face",
        description: "Inserts a smiley face emoji.",
        match: /^smiley face$/i,
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
[modifiers]: https://klembot.github.io/chapbook/guide/advanced/adding-custom-modifiers.html
[marketplace]: https://marketplace.visualstudio.com/
[Twee3]: https://github.com/iftechfoundation/twine-specs/blob/master/twee-3-specification.md
[Twine]: https://twinery.org/
