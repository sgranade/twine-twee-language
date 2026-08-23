import "mocha";
import { expect } from "chai";

import * as uut from "../config";

describe("TT3 Config From JSON", () => {
    it("should start with a default configuration", () => {
        // No arrange

        const result = uut.currentConfig;

        expect(result).to.eql({
            build: {
                storySourceFiles: [
                    "src/**/*.{tw,twee}",
                    "src/**/*.css",
                    "src/**/*.js",
                    "src/**/*.{otf,ttf,woff,woff2}",
                    "src/**/*.{gif,jpeg,jpg,png,svg,tif,tiff,webp}",
                    "src/**/*.{aac,flac,m4a,mp3,oga,ogg,opus,wav,wave,weba}",
                    "src/**/*.{mp4,ogb,webm}",
                    "src/**/*.vtt",
                ],
                includeSourcePaths: ["include"],
                outputPath: "build",
                storyFormatPaths: [".storyformats"],
            },
            tt3: { disabledDiagnostics: [] },
        });
    });

    it("should update the configuration to be defaults when given an empty string", () => {
        // No arrange

        const ret = uut.updateConfigFromJson("");
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result).to.eql({
            build: {
                storySourceFiles: [
                    "src/**/*.{tw,twee}",
                    "src/**/*.css",
                    "src/**/*.js",
                    "src/**/*.{otf,ttf,woff,woff2}",
                    "src/**/*.{gif,jpeg,jpg,png,svg,tif,tiff,webp}",
                    "src/**/*.{aac,flac,m4a,mp3,oga,ogg,opus,wav,wave,weba}",
                    "src/**/*.{mp4,ogb,webm}",
                    "src/**/*.vtt",
                ],
                includeSourcePaths: ["include"],
                outputPath: "build",
                storyFormatPaths: [".storyformats"],
            },
            tt3: { disabledDiagnostics: [] },
        });
    });

    it("should update build.storySourceFiles", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"storySourceFiles": ["meep"]}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.storySourceFiles).to.eql(["meep"]);
    });

    it("should update build.includeSourcePaths", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"includeSourcePaths": ["meep"]}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.includeSourcePaths).to.eql(["meep"]);
    });

    it("should update build.ignores", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"ignores": ["meep"]}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.ignores).to.eql(["meep"]);
    });

    it("should update build.outputPath", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"outputPath": "meep"}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.outputPath).to.eql("meep");
    });

    it("should update build.outputFilename", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"outputFilename": "meep"}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.outputFilename).to.eql("meep");
    });

    it("should update build.storyFormatPaths", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"storyFormatPaths": ["meep"]}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.storyFormatPaths).to.eql(["meep"]);
    });

    it("should update build.startPassage", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"build": {"startPassage": "meep"}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.build.startPassage).to.eql("meep");
    });

    it("should update tt3.disabledDiagnostics", () => {
        // No arrange

        const ret = uut.updateConfigFromJson(
            '{"tt3": {"disabledDiagnostics": ["meep"]}}',
        );
        const result = uut.currentConfig;

        expect(ret).to.be.undefined;
        expect(result.tt3.disabledDiagnostics).to.eql(["meep"]);
    });

    it("should cull tt3.disabledDiagnostics to keep only known diagnostic codes", () => {
        // No arrange

        uut.updateConfigFromJson(
            '{"tt3": {"disabledDiagnostics": ["meep", "meep-meep"]}}',
            ["meep-meep"],
        );
        const result = uut.currentConfig;

        expect(result.tt3.disabledDiagnostics).to.eql(["meep-meep"]);
    });

    it("should return an error containing unknown diagnostic codes", () => {
        // No arrange

        const result = uut.updateConfigFromJson(
            '{"tt3": {"disabledDiagnostics": ["meep", "meep-meep"]}}',
            ["meep-meep"],
        );

        expect(result).to.contain("meep");
    });

    it("should return no error when there are no diagnostic codes defined", () => {
        // No arrange

        const result = uut.updateConfigFromJson("", ["meep-meep"]);

        expect(result).to.be.undefined;
    });
});
