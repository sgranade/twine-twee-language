import eslint from "@eslint/js";
import { defineConfig } from "eslint/config";
import tseslint from "typescript-eslint";
import globals from "globals";

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
        files: ["client/src/media-rewriter.js"],
        languageOptions: {
            globals: {
                ...globals.browser,
                ...globals.jquery,
            },
        },
    },
);
