#!/usr/bin/env node
// Generate archives/expanded-cinema-2026-09/catalog.json from videos/ (workspace root).
// Hashes every supported video so the browser loop can pin exact bytes.
// Usage: node scripts/catalog-videos.mjs
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const root = new URL("..", import.meta.url).pathname;
const videosDir = path.join(root, "videos");
const outPath = path.join(
  root,
  "archives",
  "expanded-cinema-2026-09",
  "catalog.json"
);

const dirents = await readdir(videosDir, { recursive: false });
const files = dirents.filter((f) => f.endsWith(".mp4")).toSorted();

const entries = [];
// Sequential reads on purpose: the catalog is small and read order is
// deterministic — harness clarity over parallelism.
// oxlint-disable-next-line no-await-in-loop
for (const file of files) {
  const filePath = path.join(videosDir, file);
  // oxlint-disable-next-line no-await-in-loop
  const bytes = await readFile(filePath);
  entries.push({
    file: path.relative(videosDir, filePath).split(path.sep).join("/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const doc = {
  entries,
  generatedAt: new Date().toISOString(),
  generator: "scripts/catalog-videos.mjs",
};

await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(
  `catalog: ${entries.length} entries -> ${path.relative(root, outPath)}`
);
