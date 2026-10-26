import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";
import { flatConfigs, createNodeResolver } from "eslint-plugin-import-x";

export default defineConfig(
    eslint.configs.recommended,
    {
        files: ["**/*.ts"],
        ignores: ["**/*.test.ts"],
        ...Object.assign({}, ...tseslint.configs.recommendedTypeChecked),
        languageOptions: {
            parser: tseslint.parser,
            parserOptions: {
                projectService: true,
            },
        },
        rules: {
            "no-redeclare": "off", // Caught by ts-eslint; eslint rules gives false positives
            "no-undef": "off", // Ditto
            "no-unused-vars": "off", // Ditto ditto
            "@typescript-eslint/no-unused-vars": ["warn"],
            "@typescript-eslint/no-namespace": ["off"],
        },
    },
    {
        files: [
            "server/src/acorn-errors/**/*.ts",
            "server/src/ecma-version.ts",
        ],
        plugins: { "import-x": flatConfigs.recommended.plugins["import-x"] },
        settings: {
            "import-x/extensions": [".ts", ".js"],
            "import-x/resolver-next": [
                createNodeResolver({ extensions: [".ts", ".js"] }),
            ],
        },
        rules: { "import-x/no-cycle": "error" },
    },
    {
        files: ["client/src/media-rewriter.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
            },
        },
    },
);
