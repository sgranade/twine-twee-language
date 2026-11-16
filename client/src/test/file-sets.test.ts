import { expect } from "chai";
import { URI } from "vscode-uri";

import {
    resolveFileSets,
    resolveIncludeEntry,
    FileSetConfig,
} from "../file-sets";
import { FileType, WorkspaceProvider } from "../workspace-provider";
import { buildWorkspaceProvider } from "./builders";

function globToRegExp(glob: string): RegExp {
    let re = "";
    for (let i = 0; i < glob.length; i++) {
        const c = glob[i];
        if (c === "*" && glob[i + 1] === "*") {
            if (glob[i + 2] === "/") {
                re += "(?:.*/)?";
                i += 2;
            } else {
                re += ".*";
                i += 1;
            }
        } else if (c === "*") re += "[^/]*";
        else if (c === "{") re += "(?:";
        else if (c === "}") re += ")";
        else if (c === ",") re += "|";
        else if (".+?^$()|[]\\".includes(c)) re += "\\" + c;
        else re += c;
    }
    return new RegExp("^" + re + "$");
}

function fakeWorkspace(
    files: string[],
    directories: string[] = [],
): WorkspaceProvider {
    const provider = buildWorkspaceProvider({});
    provider.rootWorkspaceUri = () => URI.parse("file:///proj");
    provider.findFiles = async (include, exclude) => {
        const inc = globToRegExp(include);
        const exc = exclude ? globToRegExp(exclude) : undefined;
        return files
            .filter((f) => inc.test(f) && !exc?.test(f))
            .map((f) => URI.parse(`file:///proj/${f}`));
    };
    provider.fs.stat = async (uri) => ({
        type: directories.includes(uri.path.replace("/proj/", ""))
            ? FileType.Directory
            : FileType.File,
        ctime: 0,
        mtime: 0,
        size: 0,
    });
    return provider;
}

function names(uris: URI[]): string[] {
    return uris.map((u) => u.path.replace("/proj/", "")).sort();
}

const files = [
    "src/a.tw",
    "src/b.twee",
    "src/story.js",
    "src/vendor/lib.js",
    "inc/x.js",
    "inc/sub/y.js",
    "inc/style.css",
    "single.js",
    "other.txt",
];

function config(build: Partial<FileSetConfig["build"]>): FileSetConfig {
    return { build: { storySourceFiles: ["src/**/*"], ...build } };
}

describe("File-set resolution", () => {
    it("should split story source files into Twee files and story scripts", async () => {
        const result = await resolveFileSets(
            config({}),
            fakeWorkspace(files, ["inc"]),
        );

        expect(names(result.tweeFiles)).to.eql(["src/a.tw", "src/b.twee"]);
        expect(names(result.storyScriptFiles)).to.eql([
            "src/story.js",
            "src/vendor/lib.js",
        ]);
    });

    it("should subtract ignores from story scripts and Twee files", async () => {
        const result = await resolveFileSets(
            config({ ignores: ["src/vendor/**", "src/b.twee"] }),
            fakeWorkspace(files, ["inc"]),
        );

        expect(names(result.storyScriptFiles)).to.eql(["src/story.js"]);
        expect(names(result.tweeFiles)).to.eql(["src/a.tw"]);
    });

    it("should expand a directory entry recursively and keep only .js files", async () => {
        const result = await resolveFileSets(
            config({ includeSourcePaths: ["inc/"] }),
            fakeWorkspace(files, ["inc"]),
        );

        expect(names(result.includedScripts)).to.eql([
            "inc/sub/y.js",
            "inc/x.js",
        ]);
    });

    it("should keep a file entry as written and drop it if it isn't .js", async () => {
        const result = await resolveFileSets(
            config({ includeSourcePaths: ["single.js", "other.txt"] }),
            fakeWorkspace(files, ["inc"]),
        );

        expect(names(result.includedScripts)).to.eql(["single.js"]);
    });

    it("should subtract ignores from included scripts", async () => {
        const result = await resolveFileSets(
            config({ includeSourcePaths: ["inc"], ignores: ["inc/sub/**"] }),
            fakeWorkspace(files, ["inc"]),
        );

        expect(names(result.includedScripts)).to.eql(["inc/x.js"]);
    });

    it("should list a file in both sets only as a story script", async () => {
        const result = await resolveFileSets(
            config({ includeSourcePaths: ["src", "inc"] }),
            fakeWorkspace(files, ["src", "inc"]),
        );

        expect(names(result.storyScriptFiles)).to.include("src/story.js");
        expect(names(result.includedScripts)).to.eql([
            "inc/sub/y.js",
            "inc/x.js",
        ]);
    });

    it("should skip include entries that don't exist", async () => {
        const workspace = fakeWorkspace(files, ["inc"]);
        workspace.fs.stat = async () => {
            throw new Error("not found");
        };

        const result = await resolveFileSets(
            config({ includeSourcePaths: ["missing"] }),
            workspace,
        );

        expect(result.includedScripts).to.eql([]);
    });

    it("should list as included scripts the .js files the build copies", async () => {
        const workspace = fakeWorkspace(files, ["inc"]);
        const cfg = config({
            includeSourcePaths: ["inc", "single.js"],
            ignores: ["inc/sub/**"],
        });

        const { includedScripts } = await resolveFileSets(cfg, workspace);
        const result = [];
        for (const entry of cfg.build.includeSourcePaths ?? []) {
            result.push(
                ...(
                    await resolveIncludeEntry(
                        entry,
                        cfg.build.ignores,
                        workspace,
                    )
                ).files,
            );
        }

        expect(names(includedScripts)).to.eql(
            names(result.filter((f) => f.path.endsWith(".js"))),
        );
    });
});
