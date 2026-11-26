import "mocha";
import { expect } from "chai";
import { TextDocument } from "vscode-languageserver-textdocument";
import { WorkspaceEdit } from "vscode-languageserver";

import { getDefinitionAt } from "../definition";
import { updateProjectIndex, updateScriptFileIndex } from "../indexer";
import { ParseLevel } from "../parser-types";
import { Index, ScriptFileRole } from "../project-index";
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
});
