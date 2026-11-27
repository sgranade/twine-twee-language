import "mocha";
import { assert, expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { WorkspaceEdit } from "vscode-languageserver";

import { getDefinitionAt } from "../definition";
import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index, ScriptFileRole } from "../project-index";
import { OChapbookSymbolKind } from "../passage-text-parsers/chapbook/types";
import { getReferencesToSymbolAt } from "../references";
import { generateRenames } from "../renames";
import { generateDiagnostics } from "../validator";

// Essentially e2e tests for how JS vars affect Twee parsing

describe(".js File Story Variable References", () => {
    function build(
        js: string,
        passageText = "<<print $gold>>",
        {
            format = "SugarCube",
            formatVersion = "2.36.1",
            role = "story-script",
        }: {
            format?: string;
            formatVersion?: string;
            role?: ScriptFileRole;
        } = {},
    ) {
        const index = new Index();
        const tw = TextDocument.create(
            "file:///story.tw",
            "twee3",
            1,
            `:: StoryData\n{"ifid": "x", "format": "${format}", "format-version": "${formatVersion}"}\n\n` +
                `:: Start\n${passageText}\n`,
        );
        const script = TextDocument.create("file:///s.js", "javascript", 1, js);
        updateProjectIndex(tw, ParseLevel.Full, index);
        updateScriptFileIndex(script, role, ParseLevel.Full, index);
        return { index, tw, script };
    }

    it("should find .tw and .js references from a story variable in a .js file", () => {
        const { index, script } = build("State.variables.gold = 2;\n");

        const result = getReferencesToSymbolAt(
            script.uri,
            script.positionAt(script.getText().indexOf("gold")),
            index,
            true,
        );

        expect(result?.map((r) => r.uri).sort()).to.eql([
            "file:///s.js",
            "file:///story.tw",
        ]);
    });

    it("should go from a story variable in a .js file to where its assignment in .tw and .js files", () => {
        const { index, script } = build(
            "State.variables.gold = 2;\n",
            "<<set $gold to 1>>",
        );

        const definition = getDefinitionAt(
            script,
            script.positionAt(script.getText().indexOf("gold")),
            index,
        );

        expect(
            [definition]
                .flat()
                .map((d) => d?.uri)
                .sort(),
        ).to.eql(["file:///s.js", "file:///story.tw"]);
    });

    it("should clear variable-never-set in an open .tw once a .js sets the variable", async () => {
        const { index, tw } = build("// nothing\n");
        const codes = async () =>
            (await generateDiagnostics(tw, index)).map((d) => d.code);
        expect(await codes()).to.include("variable-never-set");

        updateScriptFileIndex(
            TextDocument.create(
                "file:///s.js",
                "javascript",
                2,
                "State.variables.gold = 2;\n",
            ),
            "story-script",
            ParseLevel.Full,
            index,
        );

        expect(await codes()).to.not.include("variable-never-set");
    });

    describe("Go to Story Property Definitions", () => {
        // Each definition as "<file>: <text>"
        function definitionsAt(
            js: string,
            passageText: string,
            at: string,
            options: { format?: string; formatVersion?: string } = {},
        ) {
            const { index, tw, script } = build(js, passageText, options);
            const definition = getDefinitionAt(
                tw,
                tw.positionAt(tw.getText().indexOf(at) + at.length - 1),
                index,
            );
            return [definition]
                .flat()
                .filter((d) => d !== undefined)
                .map((d) => {
                    const doc = d.uri === script.uri ? script : tw;
                    return `${d.uri.slice(-4)}: ${doc.getText(d.range)}`;
                })
                .sort();
        }

        const chapbook = { format: "Chapbook", formatVersion: "2.3.0" };

        it("should list a SugarCube property's direct writes, including an object-literal key and a .js write", () => {
            expect(
                definitionsAt(
                    "State.variables.player.hp = 2;\n",
                    "<<set $player.hp to 1>><<set $player to {hp: 3}>><<print $player.hp>>",
                    "<<print $player.hp",
                ),
            ).to.eql(["s.js: hp", "y.tw: hp", "y.tw: hp"]);
        });

        it("should list a Chapbook property's direct writes, including an object-literal key and a .js write", () => {
            expect(
                definitionsAt(
                    "engine.state.get('player').hp = 2;\nengine.state.set('player', {hp: 4});\n",
                    "player.hp: 1\nplayer: {hp: 3}\n--\n{player.hp}",
                    "{player.hp",
                    chapbook,
                ),
            ).to.eql(["s.js: hp", "s.js: hp", "y.tw: hp", "y.tw: hp"]);
        });

        it("should not find a SugarCube property written only beneath an opaque path", () => {
            expect(
                definitionsAt(
                    "State.variables.player = JSON.parse('{}');\n",
                    "<<print $player.hp>>",
                    "$player.hp",
                ),
            ).to.be.empty;
        });

        it("should not find a Chapbook property written only beneath an opaque path", () => {
            expect(
                definitionsAt(
                    "engine.state.set('player', JSON.parse('{}'));\n",
                    "{player.hp}",
                    "{player.hp",
                    chapbook,
                ),
            ).to.be.empty;
        });

        it("should not find a SugarCube property written only through a shape source", () => {
            expect(
                definitionsAt(
                    "State.variables.player.hp = 1;\n",
                    "<<set $p to $player>><<print $p.hp>>",
                    "$p.hp",
                ),
            ).to.be.empty;
        });

        it("should not find a Chapbook property written only through a shape source", () => {
            expect(
                definitionsAt(
                    "engine.state.set('player.hp', 1);\n",
                    "p: player\n--\n{p.hp}",
                    "{p.hp",
                    chapbook,
                ),
            ).to.be.empty;
        });

        it("should not find a SugarCube property that is never set", () => {
            expect(definitionsAt("", "<<print $player.hp>>", "$player.hp")).to
                .be.empty;
        });

        it("should not find a Chapbook property that is never set", () => {
            expect(definitionsAt("", "{player.hp}", "{player.hp", chapbook)).to
                .be.empty;
        });
    });

    describe("Chapbook vars-Section Object Literals", () => {
        const chapbook = { format: "Chapbook", formatVersion: "2.3.0" };

        async function neverSetTexts(passageText: string) {
            const { index, tw } = build("", passageText, chapbook);
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should count a literal's keys, nested keys included, as property writes", async () => {
            expect(
                await neverSetTexts(
                    "player: {hp: 3, stats: {str: 1}}\n--\n{player.hp} {player.stats.str} {player.mp}",
                ),
            ).to.eql(["mp"]);
        });

        it("should count the keys of a literal on a conditional line", async () => {
            expect(
                await neverSetTexts(
                    "hasHp: true\nplayer (hasHp): {hp: 3}\n--\n{player.hp}",
                ),
            ).to.eql([]);
        });

        it("should make only an opaque key's path opaque", async () => {
            expect(
                await neverSetTexts(
                    "src.fn: 1\nplayer: {inv: src.fn(), hp: 1}\n--\n{player.inv.size} {player.hpp}",
                ),
            ).to.eql(["hpp"]);
        });

        it("should check a spread against its shape source", async () => {
            expect(
                await neverSetTexts(
                    "base.hp: 1\nplayer: {...base}\n--\n{player.hp} {player.hpp}",
                ),
            ).to.eql(["hpp"]);
        });

        it("should find and rename a literal's key along with the property", () => {
            const { index, tw } = build(
                "",
                "player: {hp: 3, 'mp': 1}\n--\n{player.hp} {player.mp}",
                chapbook,
            );
            const at = tw.positionAt(tw.getText().indexOf("hp"));

            const refs = getReferencesToSymbolAt(tw.uri, at, index, true);
            const edits = generateRenames(tw.uri, at, "health", index);

            expect(refs?.map((r) => tw.getText(r.range))).to.eql(["hp", "hp"]);
            if (edits && "changes" in edits)
                expect(
                    edits?.changes?.[tw.uri].map((e) => tw.getText(e.range)),
                ).to.eql(["hp", "hp"]);
            else
                assert.fail(
                    false,
                    true,
                    "`edits` is not of type `WorkspaceEdit`",
                );
        });

        it("should find a quoted key's name, not its quotes", () => {
            const { index, tw } = build(
                "",
                "player: {'mp': 1}\n--\n{player.mp}",
                chapbook,
            );

            const refs = getReferencesToSymbolAt(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("mp")),
                index,
                true,
            );

            expect(refs?.map((r) => tw.getText(r.range))).to.eql(["mp", "mp"]);
        });

        it("should ignore a literal on a line with no variable name", () => {
            const { index } = build("", ": {hp: 1}\n--\nText", chapbook);

            expect(
                index.getProjectReferences([OChapbookSymbolKind.PropertySet]),
            ).to.be.empty;
        });
    });

    describe("Shape Sources", () => {
        async function neverSetTexts(
            js: string,
            passageText: string,
            options: { format?: string; formatVersion?: string } = {},
        ) {
            const { index, tw } = build(js, passageText, options);
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should check a .tw read of a copy a .js made against its source", async () => {
            expect(
                await neverSetTexts(
                    "State.variables.player.hp = 1;\nState.variables.p = State.variables.player;\n",
                    "<<print $p.hp + $p.hpp>>",
                ),
            ).to.eql(["hpp"]);
        });

        it("should check a .tw read of a copy a Chapbook .js made against its source", async () => {
            expect(
                await neverSetTexts(
                    "engine.state.set('player.hp', 1);\nengine.state.set('p', engine.state.get('player'));\n",
                    "{p.hp} {p.hpp}",
                    { format: "Chapbook", formatVersion: "2.3.0" },
                ),
            ).to.eql(["hpp"]);
        });

        it("should not include a copy's properties in a property's references", () => {
            const { index, tw } = build(
                "",
                "<<set $player to {hp: 1}>><<set _p to $player>><<print $player.hp + _p.hp>>",
            );

            const refs = getReferencesToSymbolAt(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("hp")),
                index,
                true,
            );

            expect(refs?.map((r) => tw.getText(r.range))).to.eql(["hp", "hp"]);
        });
    });

    describe("Chained engine.state.get in Chapbook", () => {
        async function neverSetTexts(js: string, passageText: string) {
            const { index, tw } = build(js, passageText, {
                format: "Chapbook",
                formatVersion: "2.3.0",
            });
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should count a write through a chained get as setting the path", async () => {
            expect(
                await neverSetTexts(
                    "engine.state.set('player.name', 'a');\nengine.state.get('player').hp = 3;\n",
                    "{player.hp}",
                ),
            ).to.eql([]);
        });

        it("should check a read through a chained get", async () => {
            const { index, script } = build(
                "engine.state.set('player.name', 'a');\nengine.state.get('player').hpp;\n",
                "{player.name}",
                { format: "Chapbook", formatVersion: "2.3.0" },
            );

            expect(
                (await generateDiagnostics(script, index))
                    .filter((d) => d.code === "variable-never-set")
                    .map((d) => script.getText(d.range)),
            ).to.eql(["hpp"]);
        });

        it("should check a copy of a chained get against its source", async () => {
            expect(
                await neverSetTexts(
                    "engine.state.set('player.stats.str', 1);\nengine.state.set('s', engine.state.get('player').stats);\n",
                    "{s.str} {s.stt}",
                ),
            ).to.eql(["stt"]);
        });

        it("should not warn past an indexed segment or a method call", async () => {
            const { index, script } = build(
                "engine.state.set('list', []);\nengine.state.set('inv', []);\nengine.state.get('list')[0].x;\nengine.state.get('inv').push(1).y;\n",
                "{list} {inv}",
                { format: "Chapbook", formatVersion: "2.3.0" },
            );

            expect(
                (await generateDiagnostics(script, index)).filter(
                    (d) => d.code === "variable-never-set",
                ),
            ).to.be.empty;
        });

        it("should find and rename a chained property", () => {
            const { index, tw, script } = build(
                "engine.state.set('player.hp', 1);\nengine.state.get('player').hp = 2;\n",
                "{player.hp}",
                { format: "Chapbook", formatVersion: "2.3.0" },
            );
            const chained = script.positionAt(
                script.getText().lastIndexOf("hp"),
            );

            const refs = getReferencesToSymbolAt(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("hp}")),
                index,
                true,
            );
            const renames = generateRenames(
                script.uri,
                chained,
                "health",
                index,
            ) as WorkspaceEdit;

            expect(refs?.filter((r) => r.uri === script.uri)).to.have.length(2);
            expect(
                TextDocument.applyEdits(
                    script,
                    renames.changes?.[script.uri] ?? [],
                ),
            ).to.equal(
                "engine.state.set('player.health', 1);\nengine.state.get('player').health = 2;\n",
            );
        });
    });

    describe("Object Literals Written to Story State", () => {
        async function neverSetTexts(js: string, passageText: string) {
            const { index, tw } = build(js, passageText);
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should count a .js literal's keys as property writes", async () => {
            expect(
                await neverSetTexts(
                    "State.variables.player = {hp: 1};\n",
                    "<<print $player.hp + $player.hpp>>",
                ),
            ).to.eql(["hpp"]);
        });

        it("should count a .js literal's nested keys and make only an opaque key's path opaque", async () => {
            expect(
                await neverSetTexts(
                    "State.variables.player = {stats: {str: 1}, inv: fn()};\n",
                    "<<print $player.stats.str + $player.inv.x + $player.stats.x + $player.x>>",
                ),
            ).to.eql(["x", "x"]);
        });

        it("should check a .js literal's spread against its shape source", async () => {
            expect(
                await neverSetTexts(
                    "State.variables.base = {b: 1};\nState.variables.o = {...State.variables.base, a: 1};\n",
                    "<<print $o.a + $o.b + $o.c>>",
                ),
            ).to.eql(["c"]);
        });

        it("should count the keys of a literal a .js passes to setVar", async () => {
            expect(
                await neverSetTexts(
                    "State.setVar('$player', {hp: 1});\n",
                    "<<print $player.hp + $player.hpp>>",
                ),
            ).to.eql(["hpp"]);
        });

        it("should count a <<script>> literal's keys as property writes", async () => {
            expect(
                await neverSetTexts(
                    "",
                    "<<script>>State.variables.player = {hp: 1};<</script>><<print $player.hp + $player.hpp>>",
                ),
            ).to.eql(["hpp"]);
        });

        for (const method of ["set", "setDefault"]) {
            it(`should count the keys of a literal a Chapbook .js passes to engine.state.${method}`, async () => {
                const { index, tw } = build(
                    `engine.state.${method}('player', {hp: 1, stats: {str: 1}, inv: fn()});\n`,
                    "{player.hp} {player.stats.str} {player.inv.x} {player.hpp}",
                    { format: "Chapbook", formatVersion: "2.3.0" },
                );
                expect(
                    (await generateDiagnostics(tw, index))
                        .filter((d) => d.code === "variable-never-set")
                        .map((d) => tw.getText(d.range)),
                ).to.eql(["hpp"]);
            });
        }

        it("should count the keys of a literal a Chapbook [JavaScript] modifier passes to engine.state.set", async () => {
            const { index, tw } = build(
                "",
                "[JavaScript]\nengine.state.set('player', {hp: 1});\n[continue]\n{player.hp} {player.hpp}",
                { format: "Chapbook", formatVersion: "2.3.0" },
            );
            expect(
                (await generateDiagnostics(tw, index))
                    .filter((d) => d.code === "variable-never-set")
                    .map((d) => tw.getText(d.range)),
            ).to.eql(["hpp"]);
        });

        it("should include a .js literal's key in a property's references", () => {
            const { index, tw } = build(
                "State.variables.player = {hp: 1};\n",
                "<<print $player.hp>>",
            );

            const refs = getReferencesToSymbolAt(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("hp")),
                index,
                true,
            );

            expect(refs?.map((r) => r.uri).sort()).to.eql([
                "file:///s.js",
                "file:///story.tw",
            ]);
        });

        it("should rename a .js literal's key along with the property", () => {
            const { index, tw, script } = build(
                "State.variables.player = {hp: 1};\n",
                "<<print $player.hp>>",
            );

            const edit = generateRenames(
                tw.uri,
                tw.positionAt(tw.getText().indexOf("hp")),
                "health",
                index,
            ) as WorkspaceEdit;

            expect(
                TextDocument.applyEdits(
                    script,
                    edit.changes?.[script.uri] ?? [],
                ),
            ).to.equal("State.variables.player = {health: 1};\n");
        });

        it("should count a <<run>> literal's keys as property writes", async () => {
            expect(
                await neverSetTexts(
                    "",
                    "<<run State.variables.player = {hp: 1, stats: {str: 1}, inv: JSON.parse('{}')}>>" +
                        "<<print $player.hp + $player.stats.str + $player.inv.x + $player.hpp>>",
                ),
            ).to.eql(["hpp"]);
        });
    });

    describe("Opaque Assignments", () => {
        describe("SugarCube", () => {
            async function sugarCubeNeverSetCodes(js: string) {
                const { index, tw } = build(js, "<<print $r.isError>>");
                return (await generateDiagnostics(tw, index))
                    .map((d) => d.code)
                    .filter((c) => c === "variable-never-set");
            }

            it("should not warn in a .tw on a property of a value a .js set from a call", async () => {
                expect(
                    await sugarCubeNeverSetCodes("State.variables.r = fn();\n"),
                ).to.eql([]);
            });

            it("should still warn in a .tw on a property of a known-shape value a .js set", async () => {
                expect(
                    await sugarCubeNeverSetCodes("State.variables.r = 5;\n"),
                ).to.eql(["variable-never-set"]);
            });
        });

        describe("Chapbook", () => {
            async function chapbookNeverSetCodes(
                js: string,
                role: ScriptFileRole,
            ) {
                const { index, tw } = build(js, "{r.isError}", {
                    format: "Chapbook",
                    formatVersion: "2.3.0",
                    role,
                });
                return (await generateDiagnostics(tw, index))
                    .map((d) => d.code)
                    .filter((c) => c === "variable-never-set");
            }

            for (const role of ["story-script", "included-script"] as const) {
                it(`should not warn in a .tw on a property of a value a ${role} file set from a call`, async () => {
                    expect(
                        await chapbookNeverSetCodes(
                            "engine.state.set('r', fn());\n",
                            role,
                        ),
                    ).to.eql([]);
                });
            }

            it("should still warn in a .tw on a property of a known-shape value a .js set", async () => {
                expect(
                    await chapbookNeverSetCodes(
                        "engine.state.set('r', 5);\n",
                        "story-script",
                    ),
                ).to.eql(["variable-never-set"]);
            });
        });
    });

    describe("SugarCube setup Object Properties", () => {
        async function neverSetTexts(
            js: string,
            passageText: string,
            role: ScriptFileRole = "story-script",
        ) {
            const { index, tw } = build(js, passageText, { role });
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should count a .js write to a setup property and still warn on a typo", async () => {
            expect(
                await neverSetTexts(
                    "setup.maxHp = 10;\n",
                    "<<print setup.maxHp + setup.maxHP>>",
                ),
            ).to.eql(["maxHP"]);
        });

        it("should count a setup property written in an included script", async () => {
            expect(
                await neverSetTexts(
                    "setup.maxHp = 10;\n",
                    "<<print setup.maxHp>>",
                    "included-script",
                ),
            ).to.eql([]);
        });

        for (const [desc, passageText] of [
            [
                "a script passage",
                "<<print setup.maxHp>>\n\n:: Init [script]\nsetup.maxHp = 10;",
            ],
            [
                "a <<script>> block",
                "<<script>>setup.maxHp = 10;<</script>><<print setup.maxHp>>",
            ],
        ]) {
            it(`should count a setup property written in ${desc}`, async () => {
                expect(await neverSetTexts("", passageText)).to.eql([]);
            });
        }

        it("should count a .js object literal's keys as setup property writes", async () => {
            expect(
                await neverSetTexts(
                    "setup.items = { sword: { damage: 1 } };\n",
                    "<<print setup.items.sword.damage + setup.items.shield>>",
                ),
            ).to.eql(["shield"]);
        });

        it("should count the keys of a literal Object.assign copies into setup", async () => {
            expect(
                await neverSetTexts(
                    "Object.assign(setup, { maxHp: 10, items: { sword: 1 } });\nObject.assign(setup.items, { shield: 2 });\n",
                    "<<print setup.maxHp + setup.items.sword + setup.items.shield + setup.typo>>",
                ),
            ).to.eql(["typo"]);
        });

        it("should ignore a setup property's self-reference when a .js defaults it", async () => {
            expect(
                await neverSetTexts(
                    "setup.inv = setup.inv || {};\nsetup.inv.sword = 1;\n",
                    "<<print setup.inv.sword + setup.inv.typo>>",
                ),
            ).to.eql(["typo"]);
        });

        it("should check a .js copy of a setup property against its source", async () => {
            expect(
                await neverSetTexts(
                    "setup.base = { hp: 1 };\nsetup.copy = setup.base;\n",
                    "<<set _s to setup.base>><<print setup.copy.hp + setup.copy.typo + _s.hp + _s.typo>>",
                ),
            ).to.eql(["typo", "typo"]);
        });

        it("should make a setup property opaque when a .js assigns it a value of unknown shape", async () => {
            expect(
                await neverSetTexts(
                    "setup.items = loadItems();\n",
                    "<<print setup.items.sword + setup.typo>>",
                ),
            ).to.eql(["typo"]);
        });

        for (const escape of [
            "setup.items[k] = 1;",
            "Object.assign(setup, data);",
            "fill(setup.items);",
        ]) {
            it(`should still warn on a setup property after ${escape}`, async () => {
                expect(
                    await neverSetTexts(
                        `setup.items = {};\n${escape}\n`,
                        "<<print setup.items.sword>>",
                    ),
                ).to.eql(["sword"]);
            });
        }

        describe("across .tw and .js files", () => {
            const js = "setup.maxHp = 10;\nconst hp = setup.maxHp;\n";
            const passageText = "<<set setup.maxHp to 5>><<print setup.maxHp>>";
            const atMaxHp = (doc: TextDocument) =>
                doc.positionAt(doc.getText().indexOf("maxHp"));

            it("should find a setup property's references in both files", () => {
                const { index, tw } = build(js, passageText);

                const refs = getReferencesToSymbolAt(
                    tw.uri,
                    atMaxHp(tw),
                    index,
                    true,
                );

                expect(refs?.map((r) => r.uri).sort()).to.eql([
                    "file:///s.js",
                    "file:///s.js",
                    "file:///story.tw",
                    "file:///story.tw",
                ]);
            });

            it("should rename a setup property's reads and writes in a .js", () => {
                const { index, tw, script } = build(js, passageText);

                const edit = generateRenames(
                    tw.uri,
                    atMaxHp(tw),
                    "maxHealth",
                    index,
                ) as WorkspaceEdit;

                expect(
                    TextDocument.applyEdits(
                        script,
                        edit.changes?.[script.uri] ?? [],
                    ),
                ).to.equal(
                    "setup.maxHealth = 10;\nconst hp = setup.maxHealth;\n",
                );
            });

            it("should go from a setup property in a .js to its writes in both files", () => {
                const { index, tw, script } = build(js, passageText);

                const definition = getDefinitionAt(
                    script,
                    atMaxHp(script),
                    index,
                );

                expect(
                    [definition]
                        .flat()
                        .filter((d) => d !== undefined)
                        .map((d) => {
                            const doc = d.uri === script.uri ? script : tw;
                            return `${d.uri}: ${doc.getText(d.range)}@${d.range.start.line}`;
                        })
                        .sort(),
                ).to.eql([
                    "file:///s.js: maxHp@0",
                    "file:///story.tw: maxHp@4",
                ]);
            });
        });
    });

    describe("SugarCube Setting Object", () => {
        async function neverSetTexts(
            js: string,
            passageText: string,
            role: ScriptFileRole = "story-script",
            formatVersion?: string,
        ) {
            const { index, tw } = build(js, passageText, {
                role,
                formatVersion,
            });
            return (await generateDiagnostics(tw, index))
                .filter((d) => d.code === "variable-never-set")
                .map((d) => tw.getText(d.range));
        }

        it("should count a Setting.addValue even when the project targets a version before 2.37.0", async () => {
            expect(
                await neverSetTexts(
                    'Setting.addValue("music", {});\n',
                    "<<if settings.music>><</if>>",
                    "story-script",
                    "2.20.0",
                ),
            ).to.eql([]);
        });

        it("should count a .js Setting.addToggle and still warn on a typo", async () => {
            expect(
                await neverSetTexts(
                    'Setting.addToggle("music", { label: "Music" });\n',
                    "<<if settings.music>><</if>><<if settings.musc>><</if>>",
                ),
            ).to.eql(["musc"]);
        });

        it("should count a Setting.addToggle in an included script", async () => {
            expect(
                await neverSetTexts(
                    'Setting.addToggle("music", {});\n',
                    "<<if settings.music>><</if>>",
                    "included-script",
                ),
            ).to.eql([]);
        });

        for (const [desc, passageText] of [
            [
                "a script passage",
                '<<if settings.music>><</if>>\n\n:: Init [script]\nSetting.addToggle("music", {});',
            ],
            [
                "a <<script>> block",
                '<<script>>Setting.addToggle("music", {});<</script>><<if settings.music>><</if>>',
            ],
        ]) {
            it(`should count a Setting.addToggle in ${desc}`, async () => {
                expect(await neverSetTexts("", passageText)).to.eql([]);
            });
        }

        for (const js of [
            'Setting.addHeader("music");\n',
            "Setting.addToggle(key, {});\n",
        ]) {
            it(`should still warn on a setting after only ${js.trim()}`, async () => {
                expect(
                    await neverSetTexts(js, "<<if settings.music>><</if>>"),
                ).to.eql(["music"]);
            });
        }

        it("should count a direct .js write and Setting.setValue as setting a setting", async () => {
            expect(
                await neverSetTexts(
                    'settings.music = true;\nSetting.setValue("volume", 3);\n',
                    "<<print settings.music + settings.volume>>",
                ),
            ).to.eql([]);
        });

        it("should check a copy of settings against the settings' definitions", async () => {
            expect(
                await neverSetTexts(
                    'Setting.addToggle("music", {});\n',
                    "<<set _s to settings>><<print _s.music + _s.musc>>",
                ),
            ).to.eql(["musc"]);
        });

        describe("across .tw and .js files", () => {
            const js =
                'Setting.addToggle("music", {});\nif (settings.music) { Setting.getValue("music"); }\n';
            const passageText = "<<if settings.music>><</if>>";
            const atMusic = (doc: TextDocument) =>
                doc.positionAt(doc.getText().indexOf("music"));

            it("should go from a setting in a passage to its Setting.addToggle name", () => {
                const { index, tw, script } = build(js, passageText);

                const definition = getDefinitionAt(tw, atMusic(tw), index);

                expect(
                    [definition]
                        .flat()
                        .filter((d) => d !== undefined)
                        .map(
                            (d) =>
                                `${d.uri}: ${script.getText(d.range)}@${d.range.start.line}:${d.range.start.character}`,
                        ),
                ).to.eql(["file:///s.js: music@0:19"]);
            });

            it("should find a setting's references in both files", () => {
                const { index, tw } = build(js, passageText);

                const refs = getReferencesToSymbolAt(
                    tw.uri,
                    atMusic(tw),
                    index,
                    true,
                );

                expect(refs?.map((r) => r.uri).sort()).to.eql([
                    "file:///s.js",
                    "file:///s.js",
                    "file:///s.js",
                    "file:///story.tw",
                ]);
            });

            it("should rename a setting's Setting call strings and reads in a .js", () => {
                const { index, tw, script } = build(js, passageText);

                const edit = generateRenames(
                    tw.uri,
                    atMusic(tw),
                    "sound",
                    index,
                ) as WorkspaceEdit;

                expect(
                    TextDocument.applyEdits(
                        script,
                        edit.changes?.[script.uri] ?? [],
                    ),
                ).to.equal(
                    'Setting.addToggle("sound", {});\nif (settings.sound) { Setting.getValue("sound"); }\n',
                );
                expect(
                    TextDocument.applyEdits(tw, edit.changes?.[tw.uri] ?? []),
                ).to.contain("<<if settings.sound>>");
            });
        });
    });
});
