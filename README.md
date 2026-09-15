# expanded-cinema

Daily Three.js sketch agent — expanded cinema studies (projection,
rephotography, remix, temporal relationships) rendered with WebGPU.

Status: **scaffold**. No run has fired; no gallery deployed yet.

## What this is

A related body of work, not a linear evolution and not unrelated daily
sketches: variations, revisits, and branching studies within a recognizable
thematic lane. The agent that produces them runs locally on the fleet; the
public surface is this gallery plus occasional review links.

## Stack

| Layer      | Choice                                             |
| ---------- | -------------------------------------------------- |
| Render     | three.js r186, `WebGPURenderer` (WebGPU, not WebGL) |
| Runtime    | Effect 4.0.0-rc.112 — sources, device acquisition, pipeline |
| Lifecycle  | XState `6.0.0-alpha` — run/sketch state machines    |
| Build      | pnpm workspaces + Turborepo, Vite, TS 7 strict      |
| Lint       | oxlint + ultracite, oxfmt                           |
| Infra      | alchemy → Cloudflare (cinema.wzrrd.sh)             |

## Workspace

```
apps/            the active experiment (empty between experiments)
archives/        closed experiments as buildable workspace packages
  expanded-cinema-2026-09   the first run: Vite + three.js WebGPU sketch (browser app)
packages/core    shared domain logic
videos/          source clips (ingest target), cataloged with sha256
state/           run ledger + pointers
.brain/          project brain (decisions, terms)
```

## Commands

```bash
pnpm install
pnpm dev        # sketch dev server
pnpm check      # typecheck + lint + format check
pnpm test
pnpm build
```

## License

UNLICENSED — private project, public visibility but all rights reserved.

Provenance: workspace shape from [ts-cli-template](https://github.com/joelhooks/ts-cli-template).
