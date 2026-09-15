#!/usr/bin/env node
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
import path from "node:path";

const root = new URL("..", import.meta.url).pathname;
const [sha, studyId, ...noteParts] = process.argv.slice(2);

if (sha === undefined || studyId === undefined) {
  console.error("usage: archive-ship.mjs <sha> <study-id> [note]");
  process.exit(1);
}
const joinedNote = noteParts.join(" ");
const note = joinedNote === "" ? "(no note)" : joinedNote;

const distDir = path.join(root, "archives", "expanded-cinema-2026-09", "dist");
const versionsDir = path.join(root, "versions", studyId, sha);

if (!existsSync(distDir)) {
  console.error("dist/ missing — build first: pnpm build");
  process.exit(1);
}

// Defense-in-depth (2026-09-14): an unregistered study is tree-shaken out of
// dist, so a stale build would archive a bundle WITHOUT the study. Check the
// built JS actually carries the study id before snapshotting. The registry-add
// (checklist step 1) must precede the build that produced this dist.
const distSrc = readdirSync(path.join(distDir, "assets"), {
  withFileTypes: true,
})
  .filter((e) => e.isFile() && e.name.endsWith(".js"))
  .map((e) => readFileSync(path.join(distDir, "assets", e.name), "utf-8"))
  .join("\n");
if (!distSrc.includes(studyId)) {
  console.error(
    `refusing: dist/ does not reference "${studyId}" — the module is likely still tree-shaken (unregistered). Run the registry-add + rebuild, then re-run this step.`
  );
  process.exit(2);
}

mkdirSync(versionsDir, { recursive: true });
cpSync(distDir, path.join(versionsDir, "dist"), { recursive: true });

/**
 * Content hash of the whole bundle (bundle identity, not git identity).
 * @param {string} dir — directory tree to hash.
 * @returns {string} — sha256 over sorted per-file hash lines.
 */
function hashTree(dir) {
  /** @type {string[]} */
  const parts = [];
  /**
   * Depth-first hash walk of every file under d.
   * @param {string} d — current directory.
   */
  const walk = (d) => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, entry.name);
      if (entry.isDirectory()) {
        walk(p);
      } else {
        parts.push(
          `${path.relative(dir, p)}:${createHash("sha256").update(readFileSync(p)).digest("hex")}`
        );
      }
    }
  };
  walk(dir);
  return createHash("sha256")
    .update(parts.toSorted((a, b) => (a < b ? -1 : 1)).join("\n"))
    .digest("hex");
}

const catalogPath = path.join(
  root,
  "archives",
  "expanded-cinema-2026-09",
  "catalog.json"
);
/**
 * Runtime guard for one catalog row.
 * @param {unknown} entry — candidate entry.
 * @returns {entry is { file: string, sha256: string }} — true when file+sha256 are strings.
 */
function isCatalogEntry(entry) {
  return (
    typeof entry === "object" &&
    entry !== null &&
    "file" in entry &&
    typeof entry.file === "string" &&
    "sha256" in entry &&
    typeof entry.sha256 === "string"
  );
}

/**
 * Runtime guard for the archive-era catalog shape (entries keyed by file).
 * @param {unknown} value — parsed catalog.json.
 * @returns {value is { entries: Array<{ file: string, sha256: string }> }} — true when the shape is the expected catalog shape.
 */
function isCatalog(value) {
  if (typeof value !== "object" || value === null || !("entries" in value)) {
    return false;
  }
  const { entries } = value;
  return Array.isArray(entries) && entries.every((e) => isCatalogEntry(e));
}

/** @type {unknown} */
const parsedCatalog = JSON.parse(readFileSync(catalogPath, "utf-8"));
if (!isCatalog(parsedCatalog)) {
  console.error(
    "catalog.json does not match the expected { entries: [{ file, sha256 }] } shape"
  );
  process.exit(2);
}
const catalogHashes = Object.fromEntries(
  parsedCatalog.entries.map((e) => [e.file, e.sha256])
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
  path.join(versionsDir, "manifest.json"),
  `${JSON.stringify(manifest, null, 2)}\n`
);
writeFileSync(
  path.join(versionsDir, "note.md"),
  `# ${studyId} @ ${sha}\n\n${note}\n`
);

// append to ledger if not already there
// Ledger truthfulness (2026-09-14): this row may only claim what THIS tool
// produced. The bundle hash is self-computed above; turbo/http-200 receipts
// belong to the caller's ship chain, not to this snapshot step — hardcoding
// them made every archive row assert unverified facts (caught 2026-09-14
// during a positive-path rehearsal).
const ledgerPath = path.join(root, "state", "ledger.jsonl");
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
