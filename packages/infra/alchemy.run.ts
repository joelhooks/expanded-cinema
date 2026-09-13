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

    const site = yield* Cloudflare.Website.Vite("ExpandedCinemaWeb", {
      rootDir: "../../apps/sketch",
      memo: {
        include: ["src/**", "index.html", "package.json", "vite.config.ts", "catalog.json"],
        lockfile: true,
      },
      domain: host,
      routes: [{ pattern: `${host}/*`, zoneName: ZONE }],
      observability: { enabled: true },
    });

    return {
      url: site.url,
      stage,
    };
  }),
);
