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
    const archive = yield* Cloudflare.R2.Bucket("Archive", {
      forceDestroy: stage !== "prod",
      // r2.dev public read for the archive index and older bundles;
      // rate-limited endpoint is fine for a browseable history surface.
      publicAccess: true,
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
