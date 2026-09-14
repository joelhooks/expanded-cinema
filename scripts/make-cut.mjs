#!/usr/bin/env node
/**
 * Emit a ready-to-POST current.json pointer cut to stdout.
 * Usage: node scripts/make-cut.mjs <study> <sha> [--archive-root https://cinema.wzrrd.sh]
 * Pairs with: curl -X PUT ... --data-binary @<(node scripts/make-cut.mjs clock-04 <sha>)
 */
const [study, sha] = process.argv.slice(2);
if (!study || !sha) {
  console.error("usage: make-cut.mjs <study> <sha>");
  process.exit(1);
}
const now = new Date().toISOString();
const cut = {
  study,
  sha,
  updatedAt: now,
  url: "https://cinema.wzrrd.sh/",
  archive: `/archive/${study}/${sha}/`,
};
process.stdout.write(JSON.stringify(cut));
