import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  globalIgnores([
    ".next/**",
    // Agent worktrees nest a full checkout, build output included, inside the
    // repository. Without these the lint gate reports errors from another
    // branch's compiled bundles.
    "**/.next/**",
    ".claude/worktrees/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "outputs/**",
    "work/**",
  ]),
]);

export default eslintConfig;
