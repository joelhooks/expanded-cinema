#!/usr/bin/env node
/**
 * Health sweep companion: probe the newest archived sha builds from
 * state/archive-upload-manifest.json through the live gateway.
 *
 * Replaces the hand-rolled python probes from the 2026-09-16 sweep that
 * tripped Cloudflare's bot rules with the default python UA (403 on
 * everything, false red). This client sends a real browser-ish UA.
 *
 * Exits 0 when every probed path is 200, 1 otherwise. No writes.
 */
import { readFile } from "node:fs/promises";

const BASE = "https://cinema.wzrrd.sh";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (compatible; expanded-cinema-health-sweep/1.0)",
};
const NEWEST = 6;

/**
 * @param {string} path
 * @returns {Promise<number>}
 */
async function headStatus(path) {
  try {
    const res = await fetch(`${BASE}/${path}`, { method: "GET", headers: HEADERS });
    // Drain so the socket is released.
    await res.arrayBuffer();
    return res.status;
  } catch (error) {
    console.error(`  network-error ${path}: ${/** @type {Error} */ (error).message}`);
    return 0;
  }
}

const manifest = JSON.parse(
  await readFile(new URL("../state/archive-upload-manifest.json", import.meta.url), "utf8"),
);
/** @type {{key: string}[]} */
const files = manifest.files ?? [];

const builds = new Map();
for (const file of files) {
  const m = file.key.match(/^archive\/([\w-]+)\/([0-9a-f]+)\/manifest\.json$/);
  if (m) builds.set(`${m[1]}/${m[2]}`, true);
}
const probe = [...builds.keys()].slice(-NEWEST);

if (probe.length === 0) {
  console.error("check-archives: no archive builds found in manifest");
  process.exit(1);
}

let bad = 0;
for (const spec of probe) {
  const status = await headStatus(`archive/${spec}/manifest.json`);
  if (status !== 200) bad += 1;
  console.log(`${status}  ${spec}`);
}

// Live pointer must always resolve.
const pointerStatus = await headStatus("archive/content/current.json");
if (pointerStatus !== 200) bad += 1;
console.log(`${pointerStatus}  content/current`);

if (bad > 0) {
  console.error(`check-archives: ${bad} non-200 target(s)`);
  process.exit(1);
}
console.log(`check-archives: ${probe.length + 1} targets OK`);
