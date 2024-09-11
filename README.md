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

#### Custom Chapbook Inserts and Modifiers

The plugin recognizes [custom inserts] and [modifiers][custom modifiers] defined through `engine.extend()` calls. You can add additional properties to your custom insert or modifier to add better autocomplete and hover support. All of them are optional.

-   `name` (string): The custom insert/modifier's name.
-   `syntax` (string): What the author will type to use your custom insert/modifier, such as "[custom modifier]" or "{new insert: 'text to display'}". Shown when hovering over the insert/modifier.
-   `description` (string): What your custom insert/modifier does. Shown when hovering over it.
-   `completions` (string or array of strings): The text to be used when VS Code tries to auto-complete your insert/modifier. If the insert or modifier can be invoked in multiple ways, use an array of strings. For example, the `[if]` and `[else]` modifiers are represented by a single modifier, and its completions are `['if', 'else']`.

For custom inserts, you can also specify its arguments.

-   `arguments` (object; see below): The argument and properties a custom insert takes, whether they're required or optional, and their default values.

Here's how the example custom insert from the Chapbook documentation could use these properties.

```
[JavaScript]
engine.extend('2.0.0', () => {
    engine.template.inserts.add({
        name: "icon of",
        syntax: "{icon of: 'icon', _mood: 'mood'_}",
        description: "Inserts a wizard or vampire icon with an optional mood icon. `icon` can be either `wizard` or `vampire`. `mood` is optional, and can be either `anger` or `love`.",
        completions: "icon of",
        arguments: {
            firstArgument: {
                required: true,
                placeholder: "'icon'"
            },
            optionalProps: {
                mood: "'mood'"
            }
        },
        match: /^icon of/i,
        render(firstArg, props, invocation) {
            let result = '';

            if (firstArg.toLowerCase() === 'wizard') {
                result = '🧙';
            }

            if (firstArg.toLowerCase() === 'vampire') {
                result = '🧛';
            }

            switch (props.mood.toLowerCase()) {
                case 'anger':
                    result += '💥';
                    break;

                case 'love':
                    result += '❤️';
                    break;
            }

            return result;
        }
    });
});
```

Custom insert arguments are defined by the `arguments` object. It supports three properties.

-   `firstArgument` (object, required): Information about the first argument to the insert. It has two properties:
    -   `required` (string or boolean, required): Whether the first argument is `'required'` (or `true`), `'optional'` (or `false`), or `'ignored'`.
    -   `placeholder` (string, optional): The placeholder to put in place of the first argument when completing the insert in the editor.
-   `requiredProps` (object, optional): An object containing properties that the insert must have, along with the placeholder to put in their place.
-   `optionalProps` (object, optional): An object containing properties that the insert accepts, but aren't required.

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
