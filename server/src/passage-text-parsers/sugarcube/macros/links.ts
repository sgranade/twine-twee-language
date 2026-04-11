import { MacroInfo } from "./types";

export const backMacro: MacroInfo = {
    name: "back",
    arguments: ["|+ text", "linkNoSetter", "imageNoSetter"],
    syntax: "<<back [linkText]>>\n<<back linkMarkup>>\n<<back imageMarkup>>",
    description:
        "Creates a link that undoes past moments within the story history. May be called with, optional, link text or with a link or image markup.",
    since: "2.0.0",
};

export const returnMacro: MacroInfo = {
    name: "return",
    arguments: ["|+ text", "linkNoSetter", "imageNoSetter"],
    syntax: "<<return [linkText]>>\n<<return linkMarkup>>\n<<return imageMarkup>>",
    description:
        "Creates a link that navigates forward to a previously visited passage. May be called with, optional, link text or with a link or image markup.",
    since: "2.0.0",
};

export const actionsMacro: MacroInfo = {
    name: "actions",
    arguments: [
        "passage &+ ...passage",
        "link &+ ...link",
        "image &+ ...image",
    ],
    syntax: "<<actions passageList>>\n<<actions linkMarkupList>>\n<<actions imageMarkupList>>",
    description:
        "Creates a list of single-use passage links. Each link removes itself and all other `<<actions>>` links to the same passage after being activated. May be called either with a list of passages, with a list of link markup, or with a list of image markup. Probably most useful when paired with `<<include>>`.",
    since: "2.0.0",
    deprecated: "2.37.0",
};

export const choiceMacro: MacroInfo = {
    name: "actions",
    arguments: ["passage |+ text", "link", "image"],
    syntax: "<<choice passageName [linkText]>>\n<<choice linkMarkup>>\n<<choice imageMarkup>>",
    description:
        "Creates a single-use passage link that deactivates itself and all other `<<choice>>` links within the originating passage when activated. May be called either with the passage name and link text as separate arguments, with a link markup, or with a image markup.",
    since: "2.0.0",
    deprecated: "2.37.0",
};
