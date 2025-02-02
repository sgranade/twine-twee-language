# Custom Chapbook Inserts and Modifiers

The extension recognizes [custom inserts] and [modifiers][custom modifiers] for [Chapbook] defined through `engine.extend()` calls. You can add additional properties to your custom insert or modifier for better autocomplete and hover support. All of them are optional.

-   `name` (string): The custom insert/modifier's name.
-   `syntax` (string): What the author will type to use your custom insert/modifier, such as "[custom modifier]" or "{new insert: 'text to display'}". Shown when hovering over the insert/modifier.
-   `description` (string): What your custom insert/modifier does. Shown when hovering over it.
-   `completions` (string or array of strings): The text to be used when VS Code tries to auto-complete your insert/modifier. If the insert or modifier can be invoked in multiple ways, use an array of strings. For example, the `[if]` and `[else]` modifiers are represented by a single modifier, and its completions are `['if', 'else']`. If not defined, then the insert or modifier's `name` is used.
-   `arguments` (object; see below): The argument and (for custom inserts) properties the custom insert/modifier takes, whether they're required or optional, and their default values.

Here's how the example custom modifier from the Chapbook documentation could use these properties.

```javascript
[JavaScript];
engine.extend("2.0.0", () => {
    engine.template.modifiers.add({
        name: "remove",
        syntax: "[remove _letters_], [also remove _letters_]",
        description: "Remove letters from a passage.",
        completions: ["remove", "also remove"],
        arguments: {
            firstArgument: {
                required: true,
                placeholder: "letters",
            },
        },
        match: /^(also\s)?remove\b/i,
        process(output, { invocation, state }) {
            const invokeLetters = invocation
                .replace(/^(also\s)?remove\s/, "")
                .split("");

            state.letters = (state.letters ?? []).concat(invokeLetters);

            for (const letter of state.letters) {
                output.text = output.text.replace(
                    new RegExp(letter, "gi"),
                    "X"
                );
            }
        },
    });
});
```

And here's how the custom insert from the Chapbook documentation could use these properties.

```javascript
[JavaScript];
engine.extend("2.0.0", () => {
    engine.template.inserts.add({
        name: "icon of",
        syntax: "{icon of: 'icon', _mood: 'mood'_}",
        description:
            "Inserts a wizard or vampire icon with an optional mood icon. `icon` can be either `wizard` or `vampire`. `mood` is optional, and can be either `anger` or `love`.",
        completions: "icon of",
        arguments: {
            firstArgument: {
                required: true,
                placeholder: "'icon'",
            },
            optionalProps: {
                mood: "'mood'",
            },
        },
        match: /^icon of/i,
        render(firstArg, props, invocation) {
            let result = "";

            if (firstArg.toLowerCase() === "wizard") {
                result = "🧙";
            }

            if (firstArg.toLowerCase() === "vampire") {
                result = "🧛";
            }

            switch (props.mood.toLowerCase()) {
                case "anger":
                    result += "💥";
                    break;

                case "love":
                    result += "❤️";
                    break;
            }

            return result;
        },
    });
});
```

Custom insert/modifier arguments are defined by the `arguments` object. It supports three properties.

-   `firstArgument` (object, required): Information about the first argument to the insert/modifier. It has the following properties:
    -   `required` (string or boolean, required): Whether the first argument is `'required'` (or `true`), `'optional'` (or `false`), or `'ignored'`.
    -   `placeholder` (string, optional): The placeholder to put in place of the first argument when autocompleting the insert in the editor.
    -   `type` (string, optional): The kind of value the first argument takes: `'expression'` (a Javascript expression), `'number'`, `'passage'` (a reference to a Twee passage name), `'urlOrPassage'` (either a link or a Twee passage name).
-   `requiredProps` (object, optional, insert only): An object containing properties that the insert must have, with each property having one of three values:
    -   `null` if the property's value shouldn't be autocompleted.
    -   A string which will be the property value's placeholder when being autocompleted.
    -   An object with the following properties:
        -   `placeholder` (string, optional): The placeholder to put as the property's value when autocompleting.
        -   `type` (string, optional): The kind of value the property takes: `'expression'` (a Javascript expression), `'number'`, `'passage'` (a reference to a Twee passage name), `'urlOrPassage'` (either a link or a Twee passage name).
-   `optionalProps` (object, optional, insert only): An object containing properties that the insert accepts, but aren't required.

As an example, here's how the `{ambient sound}` arguments are defined.

```javascript
{
    name: "ambient sound",
    syntax: "{ambient sound: 'sound name', _volume: 0.5_}",
    description: "Begins playing a previously-defined ambient sound. `volume` can be omitted; by default, the ambient sound is played at full volume.",
    completions: ["ambient sound"],
    arguments: {
        firstArgument: {
            required: true,
            placeholder: "'sound name'"
        },
        optionalProps: {
            volume: {
                placeholder: "0.5",
                type: "number"
            }
        }
    },
    match: /^ambient\s+sound/i
}
```

[Chapbook]: https://klembot.github.io/chapbook/
[custom inserts]: https://klembot.github.io/chapbook/guide/advanced/adding-custom-inserts.html
[custom modifiers]: https://klembot.github.io/chapbook/guide/advanced/adding-custom-modifiers.html
