#!/usr/bin/env node
/**
 * Regenerate versions/index.html from the versions/ tree itself.
 * One section per study directory, newest sha first (sorted by dir mtime
 * desc), linking /archive/<study>/<sha>/index.html plus the manifest.
 * Idempotent: deterministic output from filesystem state.
 */
import { readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const versionsDir = path.join(root, "versions");
const studies = readdirSync(versionsDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !d.name.startsWith("."))
  .map((d) => {
    const dir = path.join(versionsDir, d.name);
    const shas = readdirSync(dir, { withFileTypes: true })
      .filter((s) => s.isDirectory())
      .map((s) => s.name)
      .toSorted(
        (a, b) =>
          statSync(path.join(dir, b)).mtimeMs -
          statSync(path.join(dir, a)).mtimeMs
      );
    return { mtime: statSync(dir).mtimeMs, shas, study: d.name };
  })
  .toSorted((a, b) => b.mtime - a.mtime);

/**
 * HTML-escape &, < for attribute/element text.
 * @param {string} value — raw text.
 * @returns {string} — escaped text.
 */
const esc = (value) => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;");
const sections = studies
  .map(
    ({ study, shas }) => `<section>
  <h2>${esc(study)}</h2>
  ${shas
    .map(
      (sha) =>
        `<p class="meta"><a href="/archive/${study}/${sha}/index.html">${study}/${sha}</a> · <a href="/archive/${study}/${sha}/manifest.json">manifest</a></p>`
    )
    .join("\n  ")}
</section>`
  )
  .join("\n");

const html = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Expanded Cinema — Version Archive</title>
    <style>
      :root { color-scheme: dark; }
      body {
        margin: 0 auto;
        max-width: 40rem;
        padding: 2rem 1.25rem 4rem;
        background: #06060a;
        color: #dfe8ee;
        font: 16px/1.65 system-ui, sans-serif;
      }
      h1 { font-size: 1.4rem; font-weight: 600; letter-spacing: -0.01em; }
      h1 + p { color: #8899a6; margin-top: -0.5rem; }
      section {
        border: 1px solid #1b2430;
        border-radius: 10px;
        padding: 1rem 1.25rem;
        margin: 1.25rem 0;
      }
      h2 {
        font-family: ui-monospace, monospace;
        font-size: 0.95rem;
        margin: 0 0 0.25rem;
        color: #9be7ff;
      }
      .meta { color: #8899a6; font-size: 0.85rem; font-family: ui-monospace, monospace; }
      p { overflow-wrap: anywhere; }
      a { color: #7fc5e0; }
      .live { margin-top: 2rem; }
      code { color: #b8c8d8; font-size: 0.85em; }
    </style>
  </head>
  <body>
    <h1>Version archive</h1>
    <p>Immutable snapshots of shipped studies. Ledger is the source of truth
    for what ran and what was verified; this page is the shelf they sit on.</p>
${sections}
    <p class="live">Live pointer: <a href="https://cinema.wzrrd.sh/">cinema.wzrrd.sh</a>
    (content decides what the canvas mounts; the gallery watches it move).</p>
  </body>
</html>
`;

writeFileSync(path.join(versionsDir, "index.html"), html);
console.log(
  `archive index: ${studies.length} studies, ${studies.reduce((n, s) => n + s.shas.length, 0)} versions`
);
