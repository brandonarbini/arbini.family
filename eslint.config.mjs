import devEnvEslint from "./eslint.dev-env.mjs"; // dev-env:tool.env@1
import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // The Expo app lints itself with eslint-config-expo, from its own install.
    "mobile/**",
  ]),
  ...devEnvEslint, // dev-env:tool.env@1 — keep last so the rule cannot be overridden
]);

export default eslintConfig;
