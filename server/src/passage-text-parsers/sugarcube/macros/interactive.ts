import { MacroInfo } from "./types";

export const buttonMacro: MacroInfo = {
    name: "button",
    container: true,
    arguments: ["text |+ passage", "linkNoSetter", "imageNoSetter"],
    syntax: "<<button linkText [passageName]>> … <</button>>\n<<button linkMarkup>> … <</button>>\n<<button imageMarkup>> … <</button>>",
    description:
        "Creates a button that silently executes its contents when clicked, optionally forwarding the player to another passage. May be called with either the link text and passage name as separate arguments, a link markup, or an image markup.",
    since: "2.0.0",
};

export const checkboxMacro: MacroInfo = {
    name: "checkbox",
    arguments: [
        "receiver &+ bool|text|null|undefined|number|NaN &+ bool|text|null|undefined|number|NaN |+ 'autocheck'|'checked'",
    ],
    syntax: "<<checkbox receiverName uncheckedValue checkedValue [autocheck|checked]>>",
    description:
        "Creates a checkbox, used to modify the value of the variable with the given name.",
    since: "2.0.0",
};

export const cycleMacro: MacroInfo = {
    name: "cycle",
    container: true,
    arguments: [
        "receiver |+ 'autoselect'",
        "receiver &+ 'once' |+ 'autoselect'",
    ],
    syntax: "<<cycle receiverName [once] [autoselect]>>\n\t[<<option label [value [selected]]>> …]\n\t[<<optionsfrom collection>> …]\n\t<</cycle>>",
    description:
        "Creates a cycling link, used to modify the value of the variable with the given name. The cycling options are populated via `<<option>>` and/or `<<optionsfrom>>`.",
    since: "2.29.0",
};

export const optionMacro: MacroInfo = {
    name: "option",
    arguments: ["text |+ (bool|text|null|undefined|number|NaN |+ 'selected')"],
    parents: ["cycle", "listbox"],
    syntax: "<<option label [value [selected]]>>",
    description: "Creates an option for a `<<cycle>>` or `<<listbox>>` macro.",
    since: "2.26.0",
};

export const optionsfromMacro: MacroInfo = {
    name: "optionsfrom",
    arguments: ["expression"],
    parents: ["cycle", "listbox"],
    syntax: "<<optionsfrom collection>>",
    description:
        "Creates options from an expression that yield a collection type for a `<<cycle>>` or `<<listbox>>` macro.",
    since: "2.26.0",
};

export const linkMacro: MacroInfo = {
    name: "link",
    container: true,
    arguments: ["text |+ passage", "linkNoSetter", "imageNoSetter"],
    syntax: "<<link linkText [passageName]>> … <</link>>\n<<link linkMarkup>> … <</link>>\n<<link imageMarkup>> … <</link>>",
    description:
        "Creates a link that silently executes its contents when clicked, optionally forwarding the player to another passage. May be called with either the link text and passage name as separate arguments, a link markup, or an image markup.",
    since: "2.8.0",
};

export const linkappendMacro: MacroInfo = {
    name: "linkappend",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<linkappend linkText [transition|t8n]>> … <</linkappend>>",
    description:
        "Creates a single-use link that deactivates itself and appends its contents to its link text when clicked. Essentially, a combination of `<<link>>` and `<<append>>`.",
    since: "2.0.0",
};

export const linkprependMacro: MacroInfo = {
    name: "linkprepend",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<linkprepend linkText [transition|t8n]>> … <</linkprepend>>",
    description:
        "Creates a single-use link that deactivates itself and prepends its contents to its link text when clicked. Essentially, a combination of `<<link>>` and `<<prepend>>`.",
    since: "2.0.0",
};

export const linkreplaceMacro: MacroInfo = {
    name: "linkreplace",
    container: true,
    arguments: ["text |+ 'transition'|'t8n'"],
    syntax: "<<linkreplace linkText [transition|t8n]>> … <</linkprepend>>",
    description:
        "Creates a single-use link that deactivates itself and replaces its link text with its contents when clicked. Essentially, a combination of `<<link>>` and `<<replace>>`.",
    since: "2.0.0",
};

export const listboxMacro: MacroInfo = {
    name: "listbox",
    container: true,
    arguments: ["receiver |+ 'autoselect'"],
    syntax: "<<listbox receiverName [autoselect]>>\n\t[<<option label [value [selected]]>> …]\n\t[<<optionsfrom collection>> …]\n<</listbox>>",
    description:
        "Creates a listbox, used to modify the value of the variable with the given name. The list options are populated via `<<option>>` and/or `<<optionsfrom>>`.",
    since: "2.26.0",
};

export const numberboxMacro: MacroInfo = {
    name: "numberbox",
    arguments: [
        "receiver &+ number |+ 'autofocus'",
        "receiver &+ number |+ passage|linkNoSetter |+ 'autofocus'",
    ],
    syntax: "<<numberbox receiverName defaultValue [passage] [autofocus]>>",
    description:
        "Creates a number input box, used to modify the value of the variable with the given name, optionally forwarding the player to another passage.",
    since: "2.32.0",
};

export const radiobuttonMacro: MacroInfo = {
    name: "radiobutton",
    arguments: [
        "receiver &+ bool|number|text|null|undefined|NaN |+ 'autocheck'|'checked'",
    ],
    syntax: "<<radiobutton receiverName checkedValue [autocheck|checked]>>",
    description:
        "Creates a radio button, used to modify the value of the variable with the given name. Multiple `<<radiobutton>>` macros may be set up to modify the same variable, which makes them part of a radio button group.",
    since: "2.0.0",
};

export const textareaMacro: MacroInfo = {
    name: "textarea",
    arguments: ["receiver &+ text |+ 'autofocus'"],
    syntax: "<<textarea receiverName defaultValue [autofocus]>>",
    description:
        "Creates a multiline text input block, used to modify the value of the variable with the given name.",
    since: "2.0.0",
};

export const textboxMacro: MacroInfo = {
    name: "textbox",
    arguments: [
        "receiver &+ text |+ 'autofocus'",
        "receiver &+ text |+ passage|linkNoSetter |+ 'autofocus'",
    ],
    syntax: "<<textbox receiverName defaultValue [passage] [autofocus]>>",
    description:
        "Creates a text input box, used to modify the value of the variable with the given name, optionally forwarding the player to another passage.",
    since: "2.0.0",
};
