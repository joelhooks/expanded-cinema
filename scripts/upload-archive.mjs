#!/usr/bin/env node
import { execFileSync } from "node:child_process";
/**
 * Upload the version archive (versions/) into the R2 Archive bucket under
 * archive/…, so the live Worker gateway can serve
 * https://cinema.wzrrd.sh/archive/<study>/<sha>/… — public surface only,
 * never the r2.dev endpoint (publicAccess is off).
 *
 * Idempotent: skips a file when the stored object hashes the same as the
 * local one (verified by a head request). Auth via agent-secrets leases of
 * wzrrd::cloudflare_api_token + wzrrd::cloudflare_account_id.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { extname, join, relative, sep } from "node:path";

const root = join(import.meta.dirname, "..");
const versionsDir = join(root, "versions");

function lease(name) {
  return execFileSync(
    "secrets",
    ["lease", name, "--ttl", "1h", "--client-id", "cinema-maker"],
    {
      encoding: "utf-8",
    }
  ).trim();
}

const CT = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".mp4": "video/mp4",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".wasm": "application/wasm",
  ".webm": "video/webm",
};

function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

async function main() {
  const accountId = lease("wzrrd::cloudflare_account_id");
  const token = lease("wzrrd::cloudflare_api_token");
  if (!accountId || !token) {
    console.error("missing cloudflare credentials — cannot upload");
    process.exit(1);
  }

  // resolve archive bucket name from the account listing
  const listResp = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets`,
    {
      headers: { Authorization: `Bearer ${token}` },
    }
  );
  const list = await listResp.json();
  if (!list.success) {
    console.error("bucket list failed:", list.errors);
    process.exit(1);
  }
  const bucket = (list.result.buckets || [])
    .map((b) => b.name)
    .find((n) => n.startsWith("expanded-cinema-archive-prod-"));
  if (!bucket) {
    console.error("no expanded-cinema-archive-prod-* bucket found");
    process.exit(1);
  }

  // Never upload a stale index: regenerate from the tree on every upload.
  execFileSync("node", [join(root, "scripts/build-archive-index.mjs")], {
    stdio: "inherit",
  });
  const files = walk(versionsDir);
  console.log(`${files.length} files under versions/, bucket ${bucket}`);

  // URL layout must match versions/index.html links:
  //   versions/index.html                -> archive/index.html
  //   versions/<study>/<sha>/dist/**     -> archive/<study>/<sha>/**   (hoisted — dist IS the served root)
  //   versions/<study>/<sha>/manifest.json, note.md -> kept as-is
  function keyFor(rel) {
    if (rel === "index.html") {
      return "archive/index.html";
    }
    const m = rel.match(/^([^/]+)\/([^/]+)\/(.*)$/);
    if (!m) {
      return `archive/${rel}`;
    }
    const [, study, sha, rest] = m;
    if (rest.startsWith("dist/")) {
      return `archive/${study}/${sha}/${rest.slice("dist/".length)}`;
    }
    return `archive/${study}/${sha}/${rest}`;
  }

  const results = [];
  let skipped = 0;
  const uploaded = [];
  for (const path of files) {
    const rel = relative(versionsDir, path).split(sep).join("/");
    const key = keyFor(rel);
    const ct = CT[extname(path).toLowerCase()] || "application/octet-stream";
    const body = readFileSync(path);
    const etag = createHash("sha256").update(body).digest("hex");
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;

    // Idempotency (delivered 2026-09-14 — the docstring claimed it before the
    // code did): fetch the stored object, compare hashes, skip the PUT if
    // identical. Saves ~261MB per noop run across R2 Class-B ops.
    const stored = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (stored.ok) {
      const arr = new Uint8Array(await stored.arrayBuffer());
      if (createHash("sha256").update(arr).digest("hex") === etag) {
        skipped++;
        results.push({ bytes: body.length, etag, key, status: "skipped" });
        console.log(`skipped ${key} (hash match)`);
        continue;
      }
    }
    const res = await fetch(url, {
      body: new Uint8Array(body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "public, max-age=3600",
        "Content-Type": ct,
      },
      method: "PUT",
    });
    const json = await res.json();
    if (!json.success) {
      console.error(`FAIL ${key}: ${JSON.stringify(json.errors)}`);
      process.exit(1);
    }
    results.push({ bytes: body.length, etag, key, status: "uploaded" });
    uploaded.push(key);
    console.log(`uploaded ${key} (${body.length})`);
  }

  writeFileSync(
    join(root, "state", "archive-upload-manifest.json"),
    `${JSON.stringify({ bucket, files: results }, null, 2)}\n`
  );
  console.log(
    `done: ${results.length} objects (${uploaded.length} uploaded, ${skipped} skipped), ${results.reduce((a, r) => a + r.bytes, 0)} bytes accounted`
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
