import "mocha";
import { expect } from "chai";
import * as sinon from "sinon";
import { ImportMock } from "ts-mock-imports";
import AdmZip = require("adm-zip");
import { URI } from "vscode-uri";

import { StoryFormat } from "../client-server";
import { buildWorkspaceProvider } from "./builders";

import * as uut from "../manage-storyformats";

describe("Manage Story Formats", () => {
    describe("Story Format to Language ID", () => {
        it("should return the generic Twee language for unsupported story formats", () => {
            const storyFormat: StoryFormat = { format: "Unknown" };

            const result = uut.storyFormatToLanguageID(storyFormat, []);

            expect(result).to.equal("twee3");
        });

        it("should return the story format language based on the major version number", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const langs = [
                "twee3",
                "twee3-chapbook",
                "twee3-chapbook-2",
                "twee3-chapbook-2-1",
            ];

            const result = uut.storyFormatToLanguageID(storyFormat, langs);

            expect(result).to.equal("twee3-chapbook-2");
        });

        it("should return the most recent story format language if the story format lacks a version", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
            };
            const langs = [
                "twee3",
                "twee3-chapbook-2",
                "twee3-chapbook-1",
                "twee3-chapbook-3",
            ];

            const result = uut.storyFormatToLanguageID(storyFormat, langs);

            expect(result).to.equal("twee3-chapbook-3");
        });
    });

    describe("Story Format to Local Path", () => {
        it("should return undefined for a story format with no version", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
            };
            const provider = buildWorkspaceProvider({});

            const result = uut.storyFormatToWorkspacePath(
                storyFormat,
                provider
            );

            expect(result).to.be.undefined;
        });

        it("should return a path that starts with the story format directory configuration item", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({
                configurationItem: ".storyformatpath",
            });

            const result = uut.storyFormatToWorkspacePath(
                storyFormat,
                provider
            );

            expect(result).to.match(/^\.storyformatpath\//);
        });

        it("should return a path that includes the version", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({
                configurationItem: ".storyformatpath",
            });

            const result = uut.storyFormatToWorkspacePath(
                storyFormat,
                provider
            );

            expect(result).to.equal(
                ".storyformatpath/chapbook-2-1-3/format.js"
            );
        });

        it("should return a path that is properly resolved for a story format directory that ends in `/`", () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({
                configurationItem: ".storyformatpath/",
            });

            const result = uut.storyFormatToWorkspacePath(
                storyFormat,
                provider
            );

            expect(result).to.equal(
                ".storyformatpath/chapbook-2-1-3/format.js"
            );
        });
    });

    describe("Local Story Format Reading", () => {
        it("should read a local copy of a story format", async () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({
                configurationItem: ".fmtpath",
            });
            provider.findFiles = async (path) => {
                if (path.includes(".fmtpath/chapbook-2-1-3")) {
                    return [URI.parse("mock-chapbook-uri")];
                }
                return [];
            };
            provider.fs.readFile = async (uri) => {
                if (uri.toString().includes("mock-chapbook-uri")) {
                    return Buffer.from("I'm a story format!");
                }
                throw new Error("ENOENT: File not found");
            };

            const result = await uut.readLocalStoryFormat(
                storyFormat,
                provider
            );

            expect(result).to.equal("I'm a story format!");
        });

        it("should throw an error if the story format path can't be created", async () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
            };
            const provider = buildWorkspaceProvider({});

            let result: Error;
            try {
                await uut.readLocalStoryFormat(storyFormat, provider);
            } catch (e) {
                result = e;
            }

            expect(result.message).to.equal(
                "Couldn't create a local path for story format Chapbook version undefined"
            );
        });
    });

    describe("Local Story Format Existence", () => {
        it("should return false if the story format has no Tweego ID (i.e. has no version)", async () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
            };
            const provider = buildWorkspaceProvider({});

            const result = await uut.localStoryFormatExists(
                storyFormat,
                provider
            );

            expect(result).to.be.false;
        });

        it("should return true if the `format.js` file exists at the expected location", async () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({
                configurationItem: ".fmtpath",
            });
            provider.findFiles = async (path) => {
                if (path === ".fmtpath/chapbook-2-1-3/format.js") {
                    return [URI.parse("mock-chapbook-uri")];
                }
                return [];
            };

            const result = await uut.localStoryFormatExists(
                storyFormat,
                provider
            );

            expect(result).to.be.true;
        });

        it("should return false if the `format.js` file doesn't exist at the expected location", async () => {
            const storyFormat: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.1.3",
            };
            const provider = buildWorkspaceProvider({});
            provider.findFiles = async () => [];

            const result = await uut.localStoryFormatExists(
                storyFormat,
                provider
            );

            expect(result).to.be.false;
        });
    });

    describe("Story Format Download Support", () => {
        it("should return OK for a Chapbook story format with a version number", async () => {
            const format: StoryFormat = {
                format: "Chapbook",
                formatVersion: "2.32.1",
            };

            const result = uut.storyFormatSupportsDownloading(format);

            expect(result).to.eql(uut.StoryFormatDownloadSupport.OK);
        });

        it("should return OK for a SugarCube story format with a version number", async () => {
            const format: StoryFormat = {
                format: "SugarCube",
                formatVersion: "2.32.1",
            };

            const result = uut.storyFormatSupportsDownloading(format);

            expect(result).to.eql(uut.StoryFormatDownloadSupport.OK);
        });

        it("should return StoryFormatNotSupported for a non-SugarCube or -Chapbook story format", async () => {
            const format: StoryFormat = {
                format: "nopers",
                formatVersion: "2.32.1",
            };

            const result = uut.storyFormatSupportsDownloading(format);

            expect(result).to.eql(
                uut.StoryFormatDownloadSupport.StoryFormatNotSupported
            );
        });

        it("should return MissingVersion for a story format with a missing version", async () => {
            const format: StoryFormat = {
                format: "nopers",
            };

            const result = uut.storyFormatSupportsDownloading(format);

            expect(result).to.eql(
                uut.StoryFormatDownloadSupport.MissingVersion
            );
        });

        it("should return BadVersionFormat for a story format with a badly-formatted version number", async () => {
            const format: StoryFormat = {
                format: "nopers",
                formatVersion: "1.2.",
            };

            const result = uut.storyFormatSupportsDownloading(format);

            expect(result).to.eql(
                uut.StoryFormatDownloadSupport.BadVersionFormat
            );
        });
    });

    describe("Story Format Downloading", () => {
        // Note that the following stubs of `fetch()` don't work with all Node versions.
        // See https://github.com/sinonjs/sinon/issues/2590

        it("should return an error for a non-Chapbook or SugarCube story format", async () => {
            const mockFunction = ImportMock.mockFunction(
                globalThis,
                "fetch"
            ).returns(Promise.resolve(new Response("okay!")));

            const result = await uut.downloadStoryFormat({
                format: "nope!",
                formatVersion: "1.2.3",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Downloading story format nope! isn't currently supported"
                );
        });

        it("should return an error for a story format with no version", async () => {
            const mockFunction = ImportMock.mockFunction(
                globalThis,
                "fetch"
            ).returns(Promise.resolve(new Response("okay!")));

            const result = await uut.downloadStoryFormat({
                format: "Chapbook",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Story format downloads require a format version"
                );
        });

        it("should return the Chapbook story format for a version that's in the archive", async () => {
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(
                    sinon.match(new RegExp(uut.ChapbookArchiveUri.toString()))
                )
                .returns(Promise.resolve(new Response("totally a format")));
            mockFunction
                .withArgs(sinon.match(new RegExp(uut.ChapbookMainPage)))
                .returns(
                    Promise.resolve(new Response(undefined, { status: 404 }))
                );

            const result = await uut.downloadStoryFormat({
                format: "Chapbook",
                formatVersion: "2.2.0",
            });
            mockFunction.restore();

            expect(result).to.equal("totally a format");
        });

        it("should return the Chapbook story for a version that's the latest", async () => {
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(
                    sinon.match(new RegExp(uut.ChapbookArchiveUri.toString()))
                )
                .returns(
                    Promise.resolve(new Response(undefined, { status: 404 }))
                );
            mockFunction
                .withArgs(uut.ChapbookMainPage)
                .returns(
                    Promise.resolve(
                        new Response(
                            "here we go: https://klembot.github.io/chapbook/use/2.2.0/format.js"
                        )
                    )
                );
            mockFunction
                .withArgs(
                    "https://klembot.github.io/chapbook/use/2.2.0/format.js"
                )
                .returns(Promise.resolve(new Response("latest format")));

            const result = await uut.downloadStoryFormat({
                format: "Chapbook",
                formatVersion: "2.2.0",
            });
            mockFunction.restore();

            expect(result).to.equal("latest format");
        });

        it("should return an error if the Chapbook main page doesn't have the link to the latest format", async () => {
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(
                    sinon.match(new RegExp(uut.ChapbookArchiveUri.toString()))
                )
                .returns(
                    Promise.resolve(new Response(undefined, { status: 404 }))
                );
            mockFunction
                .withArgs(uut.ChapbookMainPage)
                .returns(
                    Promise.resolve(
                        new Response(
                            "unexpected URL: https://klembot.github.io/chapbook/use/2.2.0/renamedFormat.js"
                        )
                    )
                );

            const result = await uut.downloadStoryFormat({
                format: "Chapbook",
                formatVersion: "2.2.0",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Couldn't find the link to the latest Chapbook version to download"
                );
        });

        it("should return an error for a Chapbook story format whose version isn't in the archive or is the latest version", async () => {
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(
                    sinon.match(new RegExp(uut.ChapbookArchiveUri.toString()))
                )
                .returns(
                    Promise.resolve(new Response(undefined, { status: 404 }))
                );
            mockFunction
                .withArgs(sinon.match(new RegExp(uut.ChapbookMainPage)))
                .returns(
                    Promise.resolve(
                        new Response(
                            "here we go: https://klembot.github.io/chapbook/use/2.2.0/format.js"
                        )
                    )
                );

            const result = await uut.downloadStoryFormat({
                format: "Chapbook",
                formatVersion: "2.3.0",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Couldn't find Chapbook 2.3.0 to download"
                );
        });

        it("should return an error for a SugarCube story format version whose URL isn't found", async () => {
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(sinon.match(/github.com\/tmedwards\/sugarcube-2/))
                .returns(
                    Promise.resolve(new Response(undefined, { status: 404 }))
                );

            const result = await uut.downloadStoryFormat({
                format: "SugarCube",
                formatVersion: "2.34.1",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Couldn't find SugarCube 2.34.1 to download"
                );
        });

        it("should return the SugarCube story format for a version that's found and is in the zip archive", async () => {
            const zipFile = new AdmZip();
            zipFile.addFile(
                "example/format.js",
                Buffer.from("totally a format")
            );
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(sinon.match(/github.com\/tmedwards\/sugarcube-2/))
                .returns(Promise.resolve(new Response(zipFile.toBuffer())));

            const result = await uut.downloadStoryFormat({
                format: "SugarCube",
                formatVersion: "2.34.1",
            });
            mockFunction.restore();

            expect(result).to.equal("totally a format");
        });

        it("should return an error for a SugarCube story format whose zip archive doesn't contain `format.js`", async () => {
            const zipFile = new AdmZip();
            zipFile.addFile(
                "example/misnamedFormat.js",
                Buffer.from("totally a format")
            );
            const mockFunction = ImportMock.mockFunction(globalThis, "fetch");
            mockFunction
                .withArgs(sinon.match(/github.com\/tmedwards\/sugarcube-2/))
                .returns(Promise.resolve(new Response(zipFile.toBuffer())));

            const result = await uut.downloadStoryFormat({
                format: "SugarCube",
                formatVersion: "2.34.1",
            });
            mockFunction.restore();

            expect(result).to.be.instanceOf(Error);
            if (result instanceof Error)
                expect(result.message).to.include(
                    "Couldn't find the format.js file"
                );
        });
    });
});
