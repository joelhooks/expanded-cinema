#!/usr/bin/env node
/**
 * Emit a ready-to-POST current.json pointer cut to stdout.
 * Usage: node scripts/make-cut.mjs <study> <sha> [--archive-root https://cinema.wzrrd.sh] [--no-verify]
 * Pairs with: curl -X PUT ... --data-binary @<(node scripts/make-cut.mjs clock-04 <sha>)
 * By default the archive target is checked over HTTP first: a pointer that
 * 404s for live viewers (the b03234c-look3 bug class) fails the cut here.
 */
const args = process.argv.slice(2);
const noVerify = args.includes("--no-verify");
const positional = args.filter((a) => !a.startsWith("--"));
const [study, sha] = positional;
if (!study || !sha) {
  console.error("usage: make-cut.mjs <study> <sha> [--no-verify]");
  process.exit(1);
}
const rootIdx = args.indexOf("--archive-root");
const archiveRoot = rootIdx !== -1 ? args[rootIdx + 1] : "https://cinema.wzrrd.sh";
const archive = `/archive/${study}/${sha}/`;
if (!noVerify) {
  const target = `${archiveRoot}${archive}index.html`;
  let res;
  try {
    res = await fetch(target, { method: "HEAD" });
  } catch (e) {
    console.error(`make-cut: archive check failed for ${target}: ${e.message}`);
    process.exit(2);
  }
  if (!res.ok) {
    console.error(
      `make-cut: refusing cut — archive target ${target} is ${res.status}. Ship/upload the archive first, or pass --no-verify for a legacy label.`,
    );
    process.exit(2);
  }
  console.error(`make-cut: archive target verified (${res.status})`, );
}
const now = new Date().toISOString();
const cut = {
  study,
  sha,
  updatedAt: now,
  url: "https://cinema.wzrrd.sh/",
  archive,
};
process.stdout.write(JSON.stringify(cut));
