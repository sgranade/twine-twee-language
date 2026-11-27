import "mocha";
import { expect } from "chai";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Diagnostic } from "vscode-languageserver";
import { TextDocument } from "vscode-languageserver-textdocument";

import { parseScriptFile } from "../parser";
import { ParseLevel } from "../parser-types";
import { getStoryFormatParser } from "../passage-text-parsers";
import { conditionalReferenceQualifier } from "../passage-text-parsers/chapbook/chapbook-references";
import { OChapbookSymbolKind } from "../passage-text-parsers/chapbook/types";
import { OSugarCubeSymbolKind } from "../passage-text-parsers/sugarcube/types";
import { Index, ScriptFileRole } from "../project-index";

import { MockCallbacks } from "./builders";
import * as uut from "../indexer";

const formats = {
    SugarCube: { version: "2.36.1", kinds: OSugarCubeSymbolKind },
    Chapbook: { version: "2.3.0", kinds: OChapbookSymbolKind },
} as const;
type FormatName = keyof typeof formats;
const roles: ScriptFileRole[] = ["story-script", "included-script"];

const uri = "file:///corpus.js";

function readFixture(name: string): string {
    return readFileSync(
        join(import.meta.dirname, "fixtures", "js", name),
        "utf8",
    );
}

function indexScriptFile(
    text: string,
    format: FormatName,
    role: ScriptFileRole,
): { index: Index; doc: TextDocument } {
    const index = new Index();
    index.setStoryData(
        {
            ifid: "x",
            storyFormat: { format, formatVersion: formats[format].version },
        },
        "file:///story-data.tw",
    );
    const doc = TextDocument.create(uri, "javascript", 1, text);
    uut.updateScriptFileIndex(doc, role, ParseLevel.Full, index);
    return { index, doc };
}

/**
 * Parse errors from parsing a script file when strict parsing fails
 * and loose parse is used.
 */
function parseErrors(text: string, format: FormatName): Diagnostic[] {
    const callbacks = new MockCallbacks();
    parseScriptFile(
        TextDocument.create(uri, "javascript", 1, text),
        callbacks,
        ParseLevel.Full,
        { format, formatVersion: formats[format].version },
        getStoryFormatParser,
    );
    return callbacks.errors;
}

interface Occurrence {
    kind: string;
    contents: string;
    text: string;
    at: string;
    offset: number;
    sigilOutsideRange?: boolean;
}

/**
 * Indexed occurrences in the script file as the symbol's kind's name, its
 * contents, the text its range covers, and its start as "line:char"
 * and as an offset.
 */
function occurrences(
    index: Index,
    doc: TextDocument,
    format: FormatName,
): Occurrence[] {
    const result: Occurrence[] = [];
    for (const [kindName, kind] of Object.entries(formats[format].kinds)) {
        for (const ref of index.getReferences(uri, kind) ?? []) {
            for (const loc of ref.locations) {
                const start = loc.range.start;
                result.push({
                    kind: kindName,
                    contents: ref.contents,
                    text: doc.getText(loc.range),
                    at: `${start.line}:${start.character}`,
                    offset: doc.offsetAt(start),
                    ...(ref.sigilOutsideRange
                        ? { sigilOutsideRange: true }
                        : {}),
                });
            }
        }
    }
    return result;
}

/**
 * The part of an occurrence's name its range should cover (last segment
 * of a dotted property name w/o sigil).
 */
function nameSegment(occurrence: Occurrence): string {
    const last = occurrence.contents.split(".").at(-1) ?? "";
    return occurrence.sigilOutsideRange ? last.replace(/^[$_]/, "") : last;
}

function summarize(occurrence: Occurrence): string {
    return `${occurrence.kind} ${occurrence.contents} ${occurrence.at}`;
}

function expectExactOffsets(found: Occurrence[]): void {
    for (const occurrence of found) {
        expect(occurrence.text, JSON.stringify(occurrence)).to.equal(
            nameSegment(occurrence),
        );
    }
}

interface Mutation {
    name: string;
    /**
     * Break the text.
     *
     * @returns The broken text and function that maps a span of the
     * original text to either its offset in the broken text or undefined if the
     * mutation didn't leave the span intact.
     */
    apply: (text: string) => {
        broken: string;
        intactAt: (offset: number, length: number) => number | undefined;
    };
}

/**
 * Insert a line at the start of the line holding the text's midpoint.
 */
function insertMidFile(line: string): Mutation["apply"] {
    return (text) => {
        const lineStart = text.lastIndexOf("\n", text.length / 2) + 1;
        return {
            broken: text.slice(0, lineStart) + line + text.slice(lineStart),
            intactAt: (offset, length) =>
                offset + length <= lineStart
                    ? offset
                    : offset >= lineStart
                      ? offset + line.length
                      : undefined,
        };
    };
}

const mutations: Mutation[] = [
    {
        name: "a half-typed member mid-file",
        apply: insertMidFile("\tfoo.bar(baz.\n"),
    },
    {
        name: "truncation at 60%",
        apply: (text) => {
            const cut = Math.floor(text.length * 0.6);
            return {
                broken: text.slice(0, cut),
                intactAt: (offset, length) =>
                    offset + length <= cut ? offset : undefined,
            };
        },
    },
    {
        name: "an unterminated string",
        apply: insertMidFile('\tvar s = "unterminated;\n'),
    },
];

describe("Script File Corpus", () => {
    describe("Vendor Files", () => {
        for (const fixture of ["jquery.min.js", "lodash.min.js"]) {
            const text = readFixture(fixture);
            for (const role of roles) {
                it(`shouldn't produce SugarCube occurrences from ${fixture} as a ${role}`, () => {
                    const { index, doc } = indexScriptFile(
                        text,
                        "SugarCube",
                        role,
                    );

                    expect(occurrences(index, doc, "SugarCube")).to.be.empty;
                });

                it(`shouldn't produce qualifying Chapbook conditional references from ${fixture} as a ${role}`, () => {
                    const { index, doc } = indexScriptFile(
                        text,
                        "Chapbook",
                        role,
                    );
                    const qualifies = conditionalReferenceQualifier(index);

                    const found = occurrences(index, doc, "Chapbook");

                    expect(
                        found.filter(
                            (o) =>
                                o.kind === "ConditionalReference" &&
                                qualifies(o.contents, uri),
                        ),
                    ).to.be.empty;
                    expectExactOffsets(found);
                });
            }
        }
    });

    describe("Story Files", () => {
        const expected: Record<FormatName, [string, string[]]> = {
            SugarCube: [
                "story-sugarcube.js",
                [
                    "Variable $gold 4:44",
                    "Variable $gold 5:27",
                    "Variable $inventory 9:10",
                    "Property $inventory.includes 9:20",
                    "VariableSet $gold 4:20",
                    "VariableSet _scratch 15:20",
                    "VariableSet $visits 16:19",
                    "Variable $visits 16:43",
                    "Variable $counter0 18:58",
                    "VariableSet $flag0 18:88",
                    "Variable $counter1 19:58",
                    "VariableSet $flag1 19:88",
                    "Variable $counter2 20:58",
                    "VariableSet $flag2 20:88",
                    "Variable $counter3 21:58",
                    "VariableSet $flag3 21:88",
                    "Variable $counter0 22:58",
                    "VariableSet $flag4 22:88",
                    "Variable $counter1 23:58",
                    "VariableSet $flag5 23:88",
                    "Variable $counter2 24:58",
                    "VariableSet $flag6 24:88",
                    "Variable $counter3 25:58",
                    "VariableSet $flag7 25:88",
                    "Variable $counter0 26:58",
                    "VariableSet $flag8 26:88",
                    "Variable $counter1 27:58",
                    "VariableSet $flag9 27:88",
                    "Variable $counter2 28:60",
                    "VariableSet $flag10 28:91",
                    "Variable $counter3 29:60",
                    "VariableSet $flag11 29:91",
                    // Setup properties
                    "PropertySet setup.items 2:6",
                    "PropertySet setup.describe 7:6",
                    "PropertySet setup.visit 14:6",
                    "Property setup.items 15:36",
                    "Property setup.items.length 15:42",
                    ...Array.from(
                        { length: 12 },
                        (_, i) => `PropertySet setup.handler${i} ${18 + i}:6`,
                    ),
                ],
            ],
            Chapbook: [
                "story-chapbook.js",
                [
                    "Variable config 2:4",
                    "Variable inventory 4:40",
                    "Variable config 5:10",
                    "VariableSet gold 7:18",
                    "VariableSet gold 9:22",
                    "Variable gold 9:47",
                    "ConditionalReference gold 10:11",
                    "Property inventory.join 4:52",
                    "Variable counter0 12:61",
                    "VariableSet flag0 12:95",
                    "Variable counter1 13:61",
                    "VariableSet flag1 13:95",
                    "Variable counter2 14:61",
                    "VariableSet flag2 14:95",
                    "Variable counter3 15:61",
                    "VariableSet flag3 15:95",
                    "Variable counter0 16:61",
                    "VariableSet flag4 16:95",
                    "Variable counter1 17:61",
                    "VariableSet flag5 17:95",
                    "Variable counter2 18:61",
                    "VariableSet flag6 18:95",
                    "Variable counter3 19:61",
                    "VariableSet flag7 19:95",
                    "Variable counter0 20:61",
                    "VariableSet flag8 20:95",
                    "Variable counter1 21:61",
                    "VariableSet flag9 21:95",
                    "Variable counter2 22:63",
                    "VariableSet flag10 22:98",
                    "Variable counter3 23:63",
                    "VariableSet flag11 23:98",
                ],
            ],
        };

        for (const format of Object.keys(formats) as FormatName[]) {
            const [fixture, occurrenceList] = expected[format];

            it(`should find every occurrence in ${fixture}`, () => {
                const { index, doc } = indexScriptFile(
                    readFixture(fixture),
                    format,
                    "story-script",
                );

                const found = occurrences(index, doc, format);

                expect(found.map(summarize).sort()).to.eql(
                    [...occurrenceList].sort(),
                );
                expectExactOffsets(found);
            });
        }
    });

    describe("Broken Files", () => {
        const cases: [string, FormatName, { hasStateRoots: boolean }][] = [
            ["jquery.min.js", "SugarCube", { hasStateRoots: false }],
            ["jquery.min.js", "Chapbook", { hasStateRoots: false }],
            ["story-sugarcube.js", "SugarCube", { hasStateRoots: true }],
            ["story-chapbook.js", "Chapbook", { hasStateRoots: true }],
        ];
        const nameOf = (o: Occurrence) => `${o.kind} ${o.contents}`;

        for (const [fixture, format, { hasStateRoots }] of cases) {
            const text = readFixture(fixture);
            for (const mutation of mutations) {
                describe(`${fixture} with ${mutation.name} under ${format}`, () => {
                    const { broken, intactAt } = mutation.apply(text);
                    let original: Occurrence[];
                    let found: Occurrence[];

                    before(() => {
                        const o = indexScriptFile(text, format, "story-script");
                        original = occurrences(o.index, o.doc, format);
                        const b = indexScriptFile(
                            broken,
                            format,
                            "story-script",
                        );
                        found = occurrences(b.index, b.doc, format);
                    });

                    it("should fall back to the loose parse", () => {
                        expect(parseErrors(broken, format)).to.not.be.empty;
                    });

                    it("should keep exact offsets", () => {
                        expectExactOffsets(found);
                    });

                    it("should find the occurrences the mutation left intact", () => {
                        const intact = original.flatMap((o) => {
                            const at = intactAt(o.offset, o.text.length);
                            return at === undefined
                                ? []
                                : [`${nameOf(o)} @${at}`];
                        });

                        if (hasStateRoots) expect(intact).to.not.be.empty;
                        expect(
                            found.map((o) => `${nameOf(o)} @${o.offset}`),
                        ).to.include.members(intact);
                    });

                    if (format === "SugarCube") {
                        it("should yield no junk occurrences", () => {
                            expect(original.map(nameOf)).to.include.members(
                                found.map(nameOf),
                            );
                        });
                    }
                });
            }
        }
    });

    describe("ES Modules", () => {
        const module = [
            "import { helper } from './helper.js';",
            "export const gold = () => State.variables.gold;",
            "export default function f() { helper(); }",
        ].join("\n");

        for (const format of Object.keys(formats) as FormatName[]) {
            it(`should parse a module strictly through the module-mode retry under ${format}`, () => {
                expect(parseErrors(module, format)).to.be.empty;
            });
        }

        it("should find a module's state-root occurrences", () => {
            const { index, doc } = indexScriptFile(
                module,
                "SugarCube",
                "story-script",
            );

            expect(occurrences(index, doc, "SugarCube").map(summarize)).to.eql([
                "Variable $gold 1:42",
            ]);
        });
    });
});
