/**
 * expanded-cinema on wzrrd.sh.
 *
 * The sketch app (archives/expanded-cinema-2026-09) deploys as a Vite SPA on a Worker with
 * `cinema.wzrrd.sh` as its custom domain. The zone carries a
 * `*.wzrrd.sh/*` route to the wzrrd router and Workers routes beat custom
 * domains, so an explicit exact-host route wins the hostname back — the
 * same pattern the wzrrd-zone stack files already prove.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect, Redacted } from "effect";

const ZONE = "wzrrd.sh";

const hostname = (stage: string): string =>
  stage === "prod" ? `cinema.${ZONE}` : `cinema-${stage}.${ZONE}`;

export default Alchemy.Stack(
  "expanded-cinema",
  { providers: Cloudflare.providers(), state: Cloudflare.state() },
  Effect.gen(function* () {
    const stage = yield* Alchemy.Stage;
    const host = hostname(stage);

    // Immutable version archive: one prefix per shipped study version.
    // forceDestroy allowed only on non-prod stages so previews can be torn
    // down; prod archive is never destroy-run.
    //
    // Objects are uploaded by scripts/upload-archive.mjs (REST API) under
    // archive/<study>/<sha>/… and served only through the domestic
    // cinema.wzrrd.sh/archive route below — never the naked r2.dev bucket
    // URL, so publicAccess stays off.
    const archive = yield* Cloudflare.R2.Bucket("Archive", {
      forceDestroy: stage !== "prod",
    });

    // Domestic gateway for the immutable version archive: the SPA worker
    // owns `${host}/*`; this more-specific route wins `archive/…` and
    // serves objects straight from the ARCHIVE R2 binding.
    const archiveGateway = yield* Cloudflare.Worker("ArchiveGateway", {
      workersDev: false,
      routes: [
        { pattern: `${host}/archive/*`, zoneName: ZONE },
        { pattern: `${host}/mcp/*`, zoneName: ZONE },
        { pattern: `${host}/videos/*`, zoneName: ZONE },
      ],
      env: {
        ARCHIVE: archive,
        // secret_text binding — static bearer for the pointer-write
        // endpoint (proposal .brain/resources/mcp-write-surface-proposal.svx,
        // owner sign-off 2026-09-14). Resolved from deployment env.
        POINTER_TOKEN: Redacted.make(process.env.POINTER_TOKEN ?? ""),
      },
      script: `const CT = {
        html: "text/html; charset=utf-8",
        js: "text/javascript; charset=utf-8",
        css: "text/css; charset=utf-8",
        json: "application/json; charset=utf-8",
        md: "text/markdown; charset=utf-8",
        mp4: "video/mp4",
        webm: "video/webm",
        png: "image/png",
        svg: "image/svg+xml",
        txt: "text/plain; charset=utf-8",
      };

      function contentTypeFor(key) {
        const m = key.toLowerCase().match(/\\.([a-z0-9]+)$/);
        return (m && CT[m[1]]) || "application/octet-stream";
      }

      // MCP write surface (owner-approved 2026-09-14): exactly one key.
      // PUT /mcp/content/current moves the gallery pointer. Anything else
      // on /mcp/* is 405; anything but the validated pointer shape is 400;
      // anything without the bearer is 401. Study bundles, manifests, and
      // SPA assets are unreachable through this path by construction.
      const POINTER_KEY = "archive/content/current.json";
      const POINTER_FIELDS = ["study", "sha", "updatedAt", "url", "archive"];

      function validPointer(body) {
        if (typeof body !== "object" || body === null || Array.isArray(body)) return false;
        const keys = Object.keys(body).sort();
        if (keys.join(",") !== [...POINTER_FIELDS].sort().join(",")) return false;
        return POINTER_FIELDS.every((f) => typeof body[f] === "string" && body[f].length > 0 && body[f].length < 512);
      }

      async function handlePointerWrite(request, env) {
        const auth = request.headers.get("authorization") ?? "";
        if (!env.POINTER_TOKEN || auth !== \`Bearer \${env.POINTER_TOKEN}\`) {
          console.log(JSON.stringify({ evt: "pointer.write.reject", reason: "auth" }));
          return new Response(JSON.stringify({ error: "unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        let body;
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "invalid json" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        if (!validPointer(body)) {
          console.log(JSON.stringify({ evt: "pointer.write.reject", reason: "shape" }));
          return new Response(JSON.stringify({ error: "invalid pointer document", expected: POINTER_FIELDS }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }
        await env.ARCHIVE.put(POINTER_KEY, \`\${JSON.stringify(body, null, 2)}\\n\`, {
          httpMetadata: { contentType: "application/json; charset=utf-8" },
        });
        console.log(JSON.stringify({ evt: "pointer.write", study: body.study, sha: body.sha, updatedAt: body.updatedAt }));
        return new Response(JSON.stringify({ ok: true, key: POINTER_KEY, pointer: body }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }

      export default {
        async fetch(request, env) {
          const url = new URL(request.url);
          if (url.pathname.startsWith("/mcp/")) {
            if (url.pathname !== "/mcp/content/current") {
              return new Response(JSON.stringify({ error: "not found" }), {
                status: 404,
                headers: { "content-type": "application/json" },
              });
            }
            if (request.method !== "PUT") {
              return new Response(JSON.stringify({ error: "method not allowed" }), {
                status: 405,
                headers: { "content-type": "application/json" },
              });
            }
            return handlePointerWrite(request, env);
          }
          let path = url.pathname.slice("/archive".length);
          if (path.startsWith("/")) path = path.slice(1);
          // /videos/* reads MEDIA objects with Range support (seq-30):
          // without 206 the media element refuses to seek and the
          // deterministic reveal can never fire.
          if (url.pathname.startsWith("/videos/")) {
            const mediaKey = \`media\${url.pathname}\`;
            // parse the Range header into R2's {offset,length|suffix} shape
            let r2range;
            const rh = request.headers.get("range");
            if (rh) {
              const spec = rh.trim().replace("bytes=", "");
              const dash = spec.indexOf("-");
              const left = dash > 0 ? spec.slice(0, dash) : "";
              const right = dash >= 0 ? spec.slice(dash + 1) : "";
              if (left) {
                const start = Number(left);
                r2range = right
                  ? { offset: start, length: Number(right) - start + 1 }
                  : { offset: start };
              } else if (right) {
                r2range = { suffix: Number(right) };
              }
            }
            const mediaObj = await env.ARCHIVE.get(mediaKey, { range: r2range });
            if (!mediaObj) {
              return new Response(JSON.stringify({ error: "media not in archive", key: mediaKey }), {
                status: 404,
                headers: { "content-type": "application/json" },
              });
            }
            const mediaHeaders = new Headers({
              "content-type": mediaObj.httpMetadata?.contentType || "video/mp4",
              "accept-ranges": "bytes",
              "cache-control": "public, max-age=3600",
            });
            if (mediaObj.httpEtag) mediaHeaders.set("etag", mediaObj.httpEtag);
            if (rh && (r2range || mediaObj.range)) {
              // R2 honoured the range: mediaObj.size is the PARTIAL size and
              // mediaObj.range describes it. Recompute absolute positions
              // from the REQUESTED range (not from a re-slice of the body).
              const full = (mediaObj.range && "end" in mediaObj.range)
                ? Number(mediaObj.range.end) + 1
                : 0;
              const head = await env.ARCHIVE.head(mediaKey);
              const size = head ? head.size : full;
              const start = r2range && "offset" in r2range ? (r2range.offset ?? 0)
                : r2range && "suffix" in r2range ? Math.max(0, size - r2range.suffix) : 0;
              const end = r2range && "offset" in r2range
                ? (r2range.length !== undefined ? start + r2range.length - 1 : size - 1)
                : size - 1;
              mediaHeaders.set("content-range", \`bytes \${start}-\${end}/\${size}\`);
              return new Response(mediaObj.body, { status: 206, headers: mediaHeaders });
            }
            if (mediaObj.range) {
              const size = mediaObj.size;
              const r = mediaObj.range;
              let start;
              let end;
              if (r.suffix !== undefined) {
                start = Math.max(0, size - r.suffix);
                end = size - 1;
              } else {
                start = r.offset ?? 0;
                end = r.length !== undefined ? start + r.length - 1 : size - 1;
              }
              mediaHeaders.set(
                "content-range",
                \`bytes \${start}-\${end}/\${size}\`,
              );
              return new Response(mediaObj.body, { status: 206, headers: mediaHeaders });
            }
            return new Response(mediaObj.body, { status: 200, headers: mediaHeaders });
          }
          if (path === "") path = "index.html";
          if (path.endsWith("/")) path += "index.html";
          const key = \`archive/\${path}\`;
          const obj = await env.ARCHIVE.get(key);
          if (!obj) {
            return new Response(
              JSON.stringify({ error: "not in archive", key }),
              { status: 404, headers: { "content-type": "application/json" } },
            );
          }
          const headers = new Headers({
            "content-type": obj.httpMetadata?.contentType || contentTypeFor(key),
            "cache-control": "public, max-age=3600",
          });
          if (obj.httpEtag) headers.set("etag", obj.httpEtag);
          return new Response(obj.body, { headers });
        },
      };`,
    });

    const site = yield* Cloudflare.Website.Vite("ExpandedCinemaWeb", {
      rootDir: "../../archives/expanded-cinema-2026-09",
      memo: {
        include: ["src/**", "index.html", "package.json", "vite.config.ts", "catalog.json"],
        lockfile: true,
      },
      domain: host,
      routes: [{ pattern: `${host}/*`, zoneName: ZONE }],
      observability: { enabled: true },
      // The R2 bucket rides the worker env so a worker route can read
      // archive manifest objects (see archives/expanded-cinema-2026-09 worker-side code).
      env: {
        ARCHIVE: archive,
      },
    });

    return {
      url: site.url,
      stage,
    };
  }),
);
