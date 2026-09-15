#!/usr/bin/env node
import { execSync } from "node:child_process";
/**
 * Archive a shipped version: snapshot bundle + study note + manifest to
 * versions/<study>/<sha>/ and emit an R2-upload plan the infra step reads.
 *
 * Usage: node scripts/archive-ship.mjs <git-sha> <study-id> "<note>"
 */
import { createHash } from "node:crypto";
import {
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  cpSync,
  existsSync,
} from "node:fs";
import { join, relative } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const [sha, studyId, ...noteParts] = process.argv.slice(2);

if (!sha || !studyId) {
  console.error("usage: archive-ship.mjs <sha> <study-id> [note]");
  process.exit(1);
}
const note = noteParts.join(" ") || "";

const distDir = join(root, "archives", "expanded-cinema-2026-09", "dist");
const versionsDir = join(root, "versions", studyId, sha);

if (!existsSync(distDir)) {
  console.error("dist/ missing — build first: pnpm build");
  process.exit(1);
}

// Defense-in-depth (2026-09-14): an unregistered study is tree-shaken out of
// dist, so a stale build would archive a bundle WITHOUT the study. Check the
// built JS actually carries the study id before snapshotting. The registry-add
// (checklist step 1) must precede the build that produced this dist.
const distSrc = readdirSync(join(distDir, "assets"), { withFileTypes: true })
  .filter((e) => e.isFile() && e.name.endsWith(".js"))
  .map((e) => readFileSync(join(distDir, "assets", e.name), "utf-8"))
  .join("\n");
if (!distSrc.includes(studyId)) {
  console.error(
    `refusing: dist/ does not reference "${studyId}" — the module is likely still tree-shaken (unregistered). Run the registry-add + rebuild, then re-run this step.`
  );
  process.exit(2);
}

mkdirSync(versionsDir, { recursive: true });
cpSync(distDir, join(versionsDir, "dist"), { recursive: true });

// content hash of the whole bundle (bundle identity, not git identity)
function hashTree(dir) {
  const parts = [];
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else {
        parts.push(
          `${relative(dir, p)}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`
        );
      }
    }
  };
  walk(dir);
  return createHash("sha256").update(parts.toSorted().join("\n")).digest("hex");
}

const catalogPath = join(
  root,
  "archives",
  "expanded-cinema-2026-09",
  "catalog.json"
);
const catalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
const catalogHashes = Object.fromEntries(
  catalog.entries.map((e) => [e.file, e.sha256])
);

const manifest = {
  archive: `https://cinema.wzrrd.sh/archive/${studyId}/${sha}/`,
  archivedAt: new Date().toISOString(),
  bundleHash: hashTree(distDir),
  catalogHashes,
  note,
  sha,
  study: studyId,
  url: `https://cinema.wzrrd.sh/`,
};

writeFileSync(
  join(versionsDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);
writeFileSync(
  join(versionsDir, "note.md"),
  `# ${studyId} @ ${sha}\n\n${note}\n`
);

// append to ledger if not already there
// Ledger truthfulness (2026-09-14): this row may only claim what THIS tool
// produced. The bundle hash is self-computed above; turbo/http-200 receipts
// belong to the caller's ship chain, not to this snapshot step — hardcoding
// them made every archive row assert unverified facts (caught 2026-09-14
// during a positive-path rehearsal).
const ledgerPath = join(root, "state", "ledger.jsonl");
const row = JSON.stringify({
  archive: `archive/${studyId}/${sha}/`,
  bundleHash: manifest.bundleHash,
  date: manifest.archivedAt.slice(0, 10),
  lineage: [],
  notes: note,
  runId: `archive-${studyId}-${sha.slice(0, 7)}`,
  sha,
  stage: "archived",
  study: studyId,
  verified: [`bundle-hash ${manifest.bundleHash.slice(0, 12)}`],
});
const ledger = readFileSync(ledgerPath, "utf-8");
if (!ledger.includes(`"sha":"${sha}"`)) {
  writeFileSync(ledgerPath, `${ledger.trimEnd()}\n${row}\n`);
}

console.log(JSON.stringify(manifest, null, 2));
