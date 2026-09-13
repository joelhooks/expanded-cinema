# Expanded Cinema — daily Three.js sketch agent

Garden means edit the living system. persistent state lives in this
directory, never in a temp dir.

Read `VISION.md` for intent, audience, non-goals, and sign-off boundaries
before planning substantial work. `VISION.md` is not permission to bypass
this file. Operational rules, commands, validation, and completion gates live
here.

## Commands

```bash
pnpm install                      # workspace install
pnpm dev                          # vite dev server (apps/sketch)
pnpm check                        # typecheck + ultracite + oxfmt check
pnpm fix                          # apply oxlint/oxfmt fixes
pnpm test                         # vitest suites
pnpm build                        # turbo build (sketch bundles to dist/)
./scripts/vendor-agent-sources.sh # refresh .agent_sources mirrors
```

Required validation before claiming a change is ready:
`pnpm turbo run check test build`.

## Live agent operations

The Expanded Cinema runtime has three separate, low-noise loops. Keep these
concerns separate; a status check is not a memory write, and a memory write is
not an interruption to the maker.

1. **Incident watch** — observe the starter surface and its serving path. Treat
   intentional DGX cold starts and stale terminal output as expected. Do not
   restart or repair the DGX stack. Escalate only a new, material regression:
   the starter actually stops, a deploy regresses, or a live health check
   fails.
2. **Memory gardener** — use the Executor-backed Supermemory integration to
   record meaningful progress in two horizons:
   - short-term: timestamped observations, transient failures, deploys,
     checks, corrections, and superseded claims;
   - long-term: verified durable facts, stable decisions, invariants, and
     reusable lessons.

   Label the horizon, preserve the evidence, avoid duplicates, and never
   promote stale or unverified output into long-term memory.
3. **Dream feeder** — only when curation produces a meaningful new update,
   feed the maker a compact, evidence-backed context summary. No routine
   dumps, duplicate dreams, or speculative noise.

Operational feedback should be infrequent and specific. Tattle material
regressions to the art-director lane with evidence, implication, and whether
action is needed. Aesthetic criticism is welcome, but accuracy outranks
performative snark. Prefer current live or visual verification over old pane
output.

## Layout

| Path             | Role                                            |
| ---------------- | ----------------------------------------------- |
| `apps/sketch`    | Vite + three.js WebGPU sketch (browser app)     |
| `packages/core`  | shared domain logic (rotation, contracts)       |
| `videos/`        | root source clips (ingest pipeline target)      |
| `scripts/`       | catalog generation + vendoring helpers          |
| `state/`         | run ledger + state pointers (canonical: ledger) |
| `.brain/`        | pi-notes Brain (durable decisions, terms)       |
| `.agent_sources/`| shallow mirrors of three/effect/xstate/alchemy  |

## Standing rules

- Model pinned: `dgx-glm/glm-5.3-flash` for the daily agent. Stop and report
  when unreachable; never substitute.
- Never `git add -A`. Stage explicit paths.
- Public/Private split: no private topology, credentials, or system Brain
  content in published artifacts (pages, R2, wzrrd output, repo issues).
- `state/ledger.jsonl` is the canonical record of run outcomes; do not treat
  `STATE.json` or chat as the source of truth for "did it run".
- Video sources are authoritative via `apps/sketch/catalog.json` hashes.
- xstate v6 alpha is pinned with caretless exactness; bump deliberately.
