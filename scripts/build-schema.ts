import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

import { DiagnosticCodes } from "../server/src/diagnostics";
import { Tt3ConfigSchema } from "../client/src/config";

const outputPath = path.resolve("schema", "tt3.config.schema.json");

const diagnosticCodes = Object.values(DiagnosticCodes).sort();

function addMarkdownDescriptions(schema: any) {
    const properties = schema.properties as any;

    properties.build.properties.storySourceFiles.markdownDescription =
        "Files (relative to the project's root) to be included in the built story. Supports glob patterns. Allows any [Tweego-supported files](http://www.motoslave.net/tweego/docs/#usage-supported-files) except for `.tw2`, `.twee2`, `.htm`, and `.html`.";

    properties.build.properties.outputPath.markdownDescription =
        "Optional path (relative to the project's root) to write the story file to. If omitted, defaults to `build`.";

    properties.build.properties.storyFormatPaths.markdownDescription =
        "Path to story formats. Story formats are contained in subdirectories whose name matches the pattern `<format>-<major>-<minor>-<patch>`. Path is relative to the project's root.";
}

function addDiagnosticCodes(schema: any) {
    const disabledDiagnostics =
        schema.properties?.tt3?.properties?.disabledDiagnostics;

    if (!disabledDiagnostics) {
        throw new Error(
            "Could not find tt3.disabledDiagnostics in generated schema",
        );
    }

    const items = disabledDiagnostics.items;

    if (!items || Array.isArray(items)) {
        throw new Error("Unexpected disabledDiagnostics schema shape");
    }

    items.enum = diagnosticCodes;
}

async function main() {
    const schema = z.toJSONSchema(Tt3ConfigSchema, {
        target: "json-schema-2020-12",
    });

    schema.$schema = "https://json-schema.org/draft/2020-12/schema";

    schema.title = "Twine (Twee 3) Configuration";

    addDiagnosticCodes(schema);
    addMarkdownDescriptions(schema);

    await mkdir(path.dirname(outputPath), {
        recursive: true,
    });

    await writeFile(outputPath, JSON.stringify(schema, null, 4) + "\n", "utf8");

    console.log(`Generated ${outputPath}`);
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
