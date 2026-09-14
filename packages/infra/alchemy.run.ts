/**
 * expanded-cinema on wzrrd.sh.
 *
 * The sketch app (apps/sketch) deploys as a Vite SPA on a Worker with
 * `cinema.wzrrd.sh` as its custom domain. The zone carries a
 * `*.wzrrd.sh/*` route to the wzrrd router and Workers routes beat custom
 * domains, so an explicit exact-host route wins the hostname back — the
 * same pattern the wzrrd-zone stack files already prove.
 */
import * as Alchemy from "alchemy";
import * as Cloudflare from "alchemy/Cloudflare";
import { Effect } from "effect";

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
      routes: [{ pattern: `${host}/archive/*`, zoneName: ZONE }],
      env: { ARCHIVE: archive },
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

      export default {
        async fetch(request, env) {
          const url = new URL(request.url);
          let path = url.pathname.slice("/archive".length);
          if (path.startsWith("/")) path = path.slice(1);
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
      rootDir: "../../apps/sketch",
      memo: {
        include: ["src/**", "index.html", "package.json", "vite.config.ts", "catalog.json"],
        lockfile: true,
      },
      domain: host,
      routes: [{ pattern: `${host}/*`, zoneName: ZONE }],
      observability: { enabled: true },
      // The R2 bucket rides the worker env so a worker route can read
      // archive manifest objects (see apps/sketch worker-side code).
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
