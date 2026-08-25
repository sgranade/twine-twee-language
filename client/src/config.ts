import { z } from "zod";

import { DiagnosticCode, diagnosticCodeSet } from "@tt3/shared";

/**
 * Config file name.
 */
export const ConfigFilename = "tt3.config.json";

/**
 * Regex to match relative paths.
 */
const RelativePathRegex = /^(?!\/)(?![A-Za-z]:[\\/])(?!https?:\/\/).+/;

export const SupportedStoryFileTypes = [
    "*.{tw,twee}",
    "*.css",
    "*.js",
    "*.{otf,ttf,woff,woff2}",
    "*.{gif,jpeg,jpg,png,svg,tif,tiff,webp}",
    "*.{aac,flac,m4a,mp3,oga,ogg,opus,wav,wave,weba}",
    "*.{mp4,ogb,webm}",
    "*.vtt",
];

const RelativePath = z.string().regex(RelativePathRegex);
const RelativePathArray = z.array(RelativePath);

export const Tt3ConfigSchema = z
    .object({
        build: z
            .object({
                // The storySourceFiles description gets a markdown version in `scripts/build-schema.ts` and must be synchronized
                storySourceFiles: RelativePathArray.min(1)
                    .default(
                        SupportedStoryFileTypes.map((type) => `src/**/${type}`),
                    )
                    .describe(
                        "Files (relative to the project's root) to be included in the built story. Supports glob patterns. Allows any Tweego-supported files except for .tw2, .twee2, .htm, and .html.",
                    ),
                includeSourcePaths: RelativePathArray.default([
                    "include",
                ]).describe(
                    "Paths (relative to the project's root) whose contents will be included as-is alongside the built story.",
                ),
                ignores: RelativePathArray.optional().describe(
                    "Paths to files (relative to the project's root) to be excluded from storySourceFiles and includeSourcePaths. Supports glob patterns.",
                ),
                // The outputPath description gets a markdown version in `scripts/build-schema.ts` and must be synchronized
                outputPath: RelativePath.default("build").describe(
                    "Path (relative to the project's root) to write the story file to. If omitted, defaults to 'build'.",
                ),
                outputFilename: z
                    .string()
                    .optional()
                    .describe(
                        "Name for the story file. If omitted, defaults to the game's filename from the StoryTitle passage, with spaces replaced by hyphens.",
                    ),
                // The storyFormatPathx description gets a markdown version in `scripts/build-schema.ts` and must be synchronized
                storyFormatPaths: RelativePathArray.default([
                    ".storyformats",
                ]).describe(
                    "Path to story formats directory. Story formats are contained in subdirectories whose name matches the pattern <format>-<major>-<minor>-<patch>. Path is relative to the project's root.",
                ),
                startPassage: z
                    .string()
                    .optional()
                    .describe(
                        "Name of the starting passage. Will override the one set in the game's StoryData passage.",
                    ),
            })
            .prefault({}),
        tt3: z
            .object({
                disabledDiagnostics: z.array(z.string()).default([]),
            })
            .prefault({})
            .describe("List of diagnostic codes to be disabled project-wide."),
    })
    .prefault({});
type Tt3Config = z.infer<typeof Tt3ConfigSchema>;

/**
 * Current TT3 project configuration.
 */
export let currentConfig: Tt3Config = Tt3ConfigSchema.parse({});

/**
 * Update the project's config wholesale.
 *
 * @param newConfig New configuration.
 * @returns Description of any errors found in the config, or undefined if none.
 */
export function updateConfig(newConfig: Tt3Config): string | undefined {
    const maybeConfig = Tt3ConfigSchema.safeParse(newConfig);
    if (maybeConfig.success) {
        currentConfig = maybeConfig.data;
        const badCodes = validateConfigDiagnosticCodes();
        if (badCodes !== undefined) {
            return `Non-existent diagnostic codes: ${badCodes.join(", ")}`;
        }
    } else {
        return z.prettifyError(maybeConfig.error);
    }
}

/**
 * Update the extension's config from JSON.
 *
 * @param contents JSON contents of the config file.
 * @returns Description of any errors found in the config, or undefined if none.
 */
export function updateConfigFromJson(contents: string): string | undefined {
    // If contents is blank, turn it into a blank JSON object
    if (!contents) contents = "{}";

    let jsonContents;
    try {
        jsonContents = JSON.parse(contents);
    } catch (e) {
        return `The contents aren't valid JSON: ${(e as Error).message}`;
    }
    return updateConfig(jsonContents);
}

/**
 * Check that the current configuration's diagnostic codes are all real ones.
 *
 * @returns List of unrecognized diagnostic codes, or undefined if none.
 */
function validateConfigDiagnosticCodes(): string[] | undefined {
    // TODO When we target es2024 (starting w/VS Code 1.123 2026-06-03), use Set operations
    const badCodes = currentConfig.tt3.disabledDiagnostics.filter(
        (c) => !diagnosticCodeSet.has(c as DiagnosticCode),
    );
    currentConfig.tt3.disabledDiagnostics =
        currentConfig.tt3.disabledDiagnostics.filter((c) =>
            diagnosticCodeSet.has(c as DiagnosticCode),
        );
    if (badCodes.length > 0) return badCodes;
}
