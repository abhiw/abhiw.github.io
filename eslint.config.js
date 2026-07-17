import eslintPluginAstro from "eslint-plugin-astro";
import globals from "globals";
import tsParser from "@typescript-eslint/parser";

export default [
  ...eslintPluginAstro.configs.recommended,
  {
    // TypeScript files: use TS parser directly
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
    },
  },
  {
    // Astro files: let astro parser handle the file, TS parser handles the script block
    files: ["**/*.astro"],
    languageOptions: {
      parserOptions: {
        parser: tsParser,
      },
    },
  },
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
  { rules: { "no-console": "error" } },
  { ignores: ["dist/**", ".astro", "public/pagefind/**"] },
];
