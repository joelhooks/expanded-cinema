# Expanded Cinema — daily Three.js sketch agent

Garden means edit the living system. persistent state lives in this
directory, never in a temp dir.

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
