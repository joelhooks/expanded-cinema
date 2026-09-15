import { defineConfig } from "oxfmt";
import ultracite from "ultracite/oxfmt";

// The formatter stays on code surfaces only. Prose and machine records
// (state, versions, critiques, research, .brain doctrine) are append-only
// or hand-carved; oxfmt rewrites their blank lines and indent depth, so
// they are ignored wholesale.
export default defineConfig({
  ...ultracite,
  ignorePatterns: [
    ...(ultracite.ignorePatterns ?? []),
    ".agent_sources/**",
    ".pi/**",
    ".brain/**",
    "archives/**",
    "critiques/**",
    "docs/**",
    "media/**",
    "research/**",
    "state/**",
    "versions/**",
    "videos/**",
    "packages/infra/.alchemy/**",
  ],
});
