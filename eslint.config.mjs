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
    // Vendored mermaid, kept beside the HTML documents in docs/ so their
    // diagrams render straight from disk. It is someone else's build
    // output: nothing here is ours to fix, and linting 3 MB costs time.
    "docs/vendor/**",
    "outputs/**",
    "work/**",
  ]),
]);

export default eslintConfig;
