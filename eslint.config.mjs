import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config({
  files: ['**/*.ts'],
  ignores: ['**/*.test.ts'],
  extends: [
    eslint.configs.recommended,
    ...tseslint.configs.recommended,
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [ "warn" ],
    "@typescript-eslint/no-namespace": [ "off" ],
    "@typescript-eslint/ban-types": [ "off" ]
  }
});