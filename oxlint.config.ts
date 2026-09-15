import { defineConfig } from "oxlint";
import core from "ultracite/oxlint/core";

export default defineConfig({
  extends: [core],
  ignorePatterns: [
    ...(core.ignorePatterns ?? []),
    ".agent_sources/**",
    "**/dist/**",
    "node_modules/**",
    ".pi/**",
    // Closed experiments are frozen per layout doctrine (archives/* read-only);
    // the tree-wide lint pass may not retrofit rules onto shipped binaries.
    "**/archives/**",
  ],
  options: {
    typeAware: true,
  },
  rules: {
    // Curve-offs against established repo idioms (2026-09-15 greenkeep):
    // - func-style: the repo writes function declarations
    //   (`function tick(...)`), keep them.
    // - no-use-before-define: helpers referenced above their const
    //   declaration but CALLED after it is the intended hoist pattern
    //   in ring-capture and friends (TDZ-safe at runtime).
    // - no-inline-comments: values are annotated with a trailing
    //   comment on purpose in domain + test code.
    // - method-signature-style: Effect-style services read as methods
    //   (capabilities), not bare function properties.
    "eslint/func-style": "off",
    "eslint/no-inline-comments": "off",
    "eslint/no-use-before-define": "off",
    "typescript/method-signature-style": "off",
  },
});
