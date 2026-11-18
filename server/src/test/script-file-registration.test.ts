import "mocha";
import { expect } from "chai";
import { Disposable, TextDocumentFilter } from "vscode-languageserver/node";

import {
    buildScriptFileSelector,
    ScriptFeatureRegistrar,
    ScriptFeatureRegistrarDeps,
} from "../script-file-registration";

describe("Script File Registration", () => {
    describe("Script File Selector", () => {
        it("should list each file relative to its folder", () => {
            const uris = ["file:///w/a.js", "file:///w/b.js"];

            const result = buildScriptFileSelector(uris);

            expect(result).to.eql([
                {
                    scheme: "file",
                    pattern: { baseUri: "file:///w", pattern: "a.js" },
                },
                {
                    scheme: "file",
                    pattern: { baseUri: "file:///w", pattern: "b.js" },
                },
            ]);
        });

        it("should escape glob metacharacters and decode the file name", () => {
            const uris = ["file:///w/a%20{b}*[c]%3F.js"];

            const result = buildScriptFileSelector(uris);

            expect(result).to.eql([
                {
                    scheme: "file",
                    pattern: {
                        baseUri: "file:///w",
                        pattern: "a [{]b[}][*][[]c][?].js",
                    },
                },
            ]);
        });

        it("should leave Windows drive folders to the client", () => {
            const uris = ["file:///c%3A/s/a.js"];

            const result = buildScriptFileSelector(["file:///c%3A/s/a.js"]);

            expect(result).to.eql([
                {
                    scheme: "file",
                    pattern: { baseUri: "file:///c%3A/s", pattern: "a.js" },
                },
            ]);
        });
    });

    describe("Scriipt File Registrar", () => {
        function build(failMethod?: string) {
            const active: { method: string; selector: TextDocumentFilter[] }[] =
                [];
            const errors: string[] = [];
            const register = async (
                type: { method: string },
                options: { documentSelector: TextDocumentFilter[] },
            ): Promise<Disposable> => {
                if (type.method === failMethod) throw new Error("nope");
                const entry = {
                    method: type.method,
                    selector: options.documentSelector,
                };
                active.push(entry);
                return {
                    dispose: () => void active.splice(active.indexOf(entry), 1),
                };
            };
            const registrar = new ScriptFeatureRegistrar({
                client: {
                    register,
                } as unknown as ScriptFeatureRegistrarDeps["client"],
                prepareProvider: true,
                logError: (m) => void errors.push(m),
            });
            return { registrar, active, errors };
        }

        it("should register sync, references, definition and rename for only the given files", async () => {
            const { registrar, active } = build();

            await registrar.update(["file:///w/a.js"]);

            expect(active.map((a) => a.method).sort()).to.eql([
                "textDocument/definition",
                "textDocument/didChange",
                "textDocument/didClose",
                "textDocument/didOpen",
                "textDocument/references",
                "textDocument/rename",
            ]);
            for (const a of active) {
                expect(a.selector).to.eql(
                    buildScriptFileSelector(["file:///w/a.js"]),
                );
            }
        });

        it("should re-register only when the set of files changes", async () => {
            const { registrar, active } = build();
            await registrar.update(["file:///w/a.js"]);
            const first = [...active];

            await registrar.update(["file:///w/a.js"]);
            expect(active).to.eql(first);
            expect(active[0]).to.equal(first[0]);

            await registrar.update(["file:///w/b.js"]);
            expect(active).to.have.length(6);
            expect(active[0].selector).to.eql(
                buildScriptFileSelector(["file:///w/b.js"]),
            );
        });

        it("should leave nothing registered and retry after a partial failure", async () => {
            const { registrar, active, errors } = build(
                "textDocument/references",
            );

            await registrar.update(["file:///w/a.js"]);
            expect(active).to.eql([]);
            expect(errors).to.have.length(1);

            await registrar.update(["file:///w/a.js"]);
            expect(errors).to.have.length(2);
        });
    });
});
