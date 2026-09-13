#!/usr/bin/env node
// Generate apps/sketch/catalog.json from videos/ (workspace root).
// Hashes every supported video so the browser loop can pin exact bytes.
// Usage: node scripts/catalog-videos.mjs
import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import { join, relative, sep } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const videosDir = join(root, "videos");
const outPath = join(root, "apps", "sketch", "catalog.json");

const files = (await readdir(videosDir, { recursive: false }))
  .filter((f) => f.endsWith(".mp4"))
  .sort();

const entries = [];
for (const file of files) {
  const bytes = await readFile(join(videosDir, file));
  entries.push({
    file: relative(videosDir, join(videosDir, file)).split(sep).join("/"),
    sha256: createHash("sha256").update(bytes).digest("hex"),
  });
}

const doc = {
  generatedAt: new Date().toISOString(),
  generator: "scripts/catalog-videos.mjs",
  entries,
};

await writeFile(outPath, `${JSON.stringify(doc, null, 2)}\n`);
console.log(`catalog: ${entries.length} entries -> ${relative(root, outPath)}`);
