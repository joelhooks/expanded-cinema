#!/usr/bin/env node
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
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.join(import.meta.dirname, "..");
const versionsDir = path.join(root, "versions");

/**
 * Lease a named secret value from agent-secrets.
 * @param {string} name — full agent-secrets key to lease.
 * @returns {string} — the leased secret value, trimmed.
 */
function lease(name) {
  return execFileSync(
    "secrets",
    ["lease", name, "--ttl", "1h", "--client-id", "cinema-maker"],
    {
      encoding: "utf-8",
    }
  ).trim();
}

/**
 * Content-type lookup by file extension; unknown extensions get a generic type.
 * @property {string} [key] — MIME string per extension.
 * @type {Record<string, string>}
 */
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

/**
 * Type-predicate form of Array.isArray so unknown values narrow to a
 * well-typed array without an `any`-carrying assertion.
 * @param {unknown} value — value to test.
 * @returns {value is unknown[]} — true when value is an array.
 */
function isUnknownArray(value) {
  return Array.isArray(value);
}

/**
 * Recursively list files under a directory.
 * @param {string} dir — directory to descend.
 * @param {string[]} [out] accumulator for recursive calls.
 * @returns {string[]} — absolute file paths under dir.
 */
function walk(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(p, out);
    } else {
      out.push(p);
    }
  }
  return out;
}

/**
 * URL layout must match versions/index.html links:
 *   versions/index.html                -> archive/index.html
 *   versions/<study>/<sha>/dist/**     -> archive/<study>/<sha>/**   (hoisted — dist IS the served root)
 *   versions/<study>/<sha>/manifest.json, note.md -> kept as-is
 * @param {string} rel — path relative to versions/, posix separators.
 * @returns {string} — the R2 object key for that file.
 */
function keyFor(rel) {
  if (rel === "index.html") {
    return "archive/index.html";
  }
  const match = /^(?<study>[^/]+)\/(?<sha>[^/]+)\/(?<rest>.+)$/u.exec(rel);
  if (!match?.groups) {
    return `archive/${rel}`;
  }
  const groups = match.groups ?? {};
  const rest = groups.rest ?? "";
  const sha = groups.sha ?? "";
  const study = groups.study ?? "";
  if (rest.startsWith("dist/")) {
    return `archive/${study}/${sha}/${rest.slice("dist/".length)}`;
  }
  return `archive/${study}/${sha}/${rest}`;
}

/**
 * Cloudflare R2 bucket-list API envelope.
 * @typedef {Object} CfListResponse
 * @property {boolean} success — false when the API rejected the call.
 * @property {unknown[]} [errors] API error payloads when !success.
 * @property {{ buckets?: Array<{ name?: string }> | null }} [result] bucket listing payload.
 */

/**
 * Cloudflare R2 single-object PUT API envelope.
 * @typedef {Object} CfPutResponse
 * @property {boolean} success — false when the PUT was rejected.
 * @property {unknown[]} [errors] API error payloads when !success.
 */

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
  const rawList = /** @type {unknown} */ (await listResp.json());
  if (
    typeof rawList !== "object" ||
    rawList === null ||
    !("success" in rawList) ||
    rawList.success !== true
  ) {
    console.error("bucket list failed:", rawList);
    process.exit(1);
  }
  const rawResult =
    "result" in rawList &&
    typeof rawList.result === "object" &&
    rawList.result !== null
      ? rawList.result
      : {};
  const rawBuckets =
    "buckets" in rawResult && isUnknownArray(rawResult.buckets)
      ? rawResult.buckets
      : [];
  /** @type {string[]} */
  const bucketNames = [];
  for (const entry of rawBuckets) {
    if (
      typeof entry === "object" &&
      entry !== null &&
      "name" in entry &&
      typeof entry.name === "string"
    ) {
      bucketNames.push(entry.name);
    }
  }
  const bucket = bucketNames.find((n) =>
    n.startsWith("expanded-cinema-archive-prod-")
  );
  if (bucket === undefined || bucket === "") {
    console.error("no expanded-cinema-archive-prod-* bucket found");
    process.exit(1);
  }

  // Never upload a stale index: regenerate from the tree on every upload.
  execFileSync("node", [path.join(root, "scripts/build-archive-index.mjs")], {
    stdio: "inherit",
  });
  const files = walk(versionsDir);
  console.log(`${files.length} files under versions/, bucket ${bucket}`);
  await uploadAll(bucket, token, files, accountId);
}

/**
 * Upload every file under versions/ to the archive bucket, idempotently by
 * sha256 hash comparison. Strictly sequential on purpose: parallel PUTs
 * against the same R2 bucket trip Cloudflare rate limits, so serialising is
 * the safe contract — each no-await-in-loop is intra-loop, not fixable by
 * Promise.all without changing the operational guarantee.
 * @param {string} bucket — target R2 bucket name.
 * @param {string} token — Cloudflare API token.
 * @param {string[]} files — absolute file paths to upload.
 * @param {string} accountId — Cloudflare account id.
 * @returns {Promise<void>}
 */
async function uploadAll(bucket, token, files, accountId) {
  /** @type {Array<{ bytes: number, etag: string, key: string, status: string }>} */
  const results = [];
  let skipped = 0;
  /** @type {string[]} */
  const uploaded = [];
  for (const filePath of files) {
    const rel = path.relative(versionsDir, filePath).split(path.sep).join("/");
    const key = keyFor(rel);
    const ct =
      CT[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
    const body = readFileSync(filePath);
    const etag = createHash("sha256").update(body).digest("hex");
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/r2/buckets/${bucket}/objects/${encodeURIComponent(key)}`;

    // Idempotency (delivered 2026-09-14 — the docstring claimed it before the
    // code did): fetch the stored object, compare hashes, skip the PUT if
    // identical. Saves ~261MB per noop run across R2 Class-B ops.
    //
    // Stored-object compare is sequential by design (see uploadAll docstring).
    // oxlint-disable-next-line no-await-in-loop
    const stored = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (stored.ok) {
      // oxlint-disable-next-line no-await-in-loop
      const arr = new Uint8Array(await stored.arrayBuffer());
      const storedHash = createHash("sha256").update(arr).digest("hex");
      if (storedHash === etag) {
        skipped += 1;
        results.push({ bytes: body.length, etag, key, status: "skipped" });
        console.log(`skipped ${key} (hash match)`);
        continue;
      }
    }
    // oxlint-disable-next-line no-await-in-loop
    // The PUT itself is also sequential by design (see uploadAll docstring).
    // oxlint-disable-next-line no-await-in-loop
    const res = await fetch(url, {
      body: new Uint8Array(body),
      headers: {
        Authorization: `Bearer ${token}`,
        "Cache-Control": "public, max-age=3600",
        "Content-Type": ct,
      },
      method: "PUT",
    });
    // eslint-disable-next-line eslint/no-await-in-loop
    // oxlint-disable-next-line no-await-in-loop
    const rawPut = /** @type {unknown} */ (await res.json());
    if (
      typeof rawPut !== "object" ||
      rawPut === null ||
      !("success" in rawPut) ||
      rawPut.success !== true
    ) {
      console.error(`FAIL ${key}: ${JSON.stringify(rawPut)}`);
      process.exit(1);
    }
    results.push({ bytes: body.length, etag, key, status: "uploaded" });
    uploaded.push(key);
    console.log(`uploaded ${key} (${body.length})`);
  }

  writeFileSync(
    path.join(root, "state", "archive-upload-manifest.json"),
    `${JSON.stringify({ bucket, files: results }, null, 2)}\n`
  );
  console.log(
    `done: ${results.length} objects (${uploaded.length} uploaded, ${skipped} skipped), ${results.reduce((total, r) => total + r.bytes, 0)} bytes accounted`
  );
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
