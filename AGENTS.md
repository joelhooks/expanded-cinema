# Expanded Cinema — iteration loop agent

Garden means edit the living system. Persistent state lives in this
directory, never in a temp dir.

Read `VISION.md` for intent and targets before substantial work. This file
holds the operational rules. Where the two disagree, this file wins for how
and `VISION.md` wins for why.

## The loop, in one paragraph

You are the loop agent. You run iterations: one variable, one build, one
archived URL, one critic verdict, one ledger row, then the next iteration in
the same turn. The `cinema-loop` extension in `.pi/extensions/` enforces the
parts that a model has been shown to skip: it blocks a pointer cut without a
fresh passing verdict, blocks any ledger write except appends, blocks edits
to doctrine, and kicks you when you go idle in loop mode. Load the
`iteration-loop` skill and follow it. Turn the loop on with `/loop on
<study>`.

## Commands

```bash
pnpm install                      # workspace install
pnpm dev                          # vite dev server for the active study package
pnpm check                        # typecheck + ultracite + oxfmt check
pnpm fix                          # apply oxlint/oxfmt fixes
pnpm test                         # vitest suites
pnpm build                        # turbo build
pnpm turbo run check test build   # the gate; run before archive-ship
node scripts/archive-ship.mjs <sha> <study> "<note>"   # snapshot a build
node scripts/upload-archive.mjs                        # push snapshots to R2
node scripts/make-cut.mjs <study> <sha>                # pointer body (cut is gated)
```

Tools the extension adds: `cinema_verify` (frames plus vision critic, writes
`state/verdicts/<sha>.json`), `cinema_ledger_append` (the only ledger
write), and the `/loop on|off|status` command.

## Layout

| Path                 | Role                                                          |
| -------------------- | ------------------------------------------------------------- |
| `apps/*`             | the active experiment (one package)                           |
| `archives/*`         | closed experiments, buildable, read-only                       |
| `packages/core`      | shared domain logic (rotation, contracts)                      |
| `packages/infra`     | Cloudflare Workers and R2 through alchemy                      |
| `videos/`            | source clips (ingest target; large files stay out of git)     |
| `scripts/`           | archive, upload, cut, catalog helpers                          |
| `state/`             | `ledger.jsonl` (canonical, append-only), `loop.json`, verdicts |
| `critiques/`         | frames and critique notes per sha                              |
| `research/`          | study chains and provenance                                    |
| `.brain/`            | pi-notes Brain: doctrine, queue, decisions, archives           |
| `.pi/`               | agent surfaces: extension, skills, prompts (read-only to you)  |

## Standing rules

- Model pinned: `dgx-glm/glm-5.3-flash` for the loop agent. Stop and report
  when unreachable; never substitute. The critic runs locally on
  `mlx-community/Qwen2.5-VL-7B-Instruct-4bit` through `cinema_verify`.
- Never `git add -A`. Stage explicit paths. Never bypass hooks.
- `state/ledger.jsonl` is the canonical record. It is append-only. A wrong
  row gets a superseding row that names it. The extension blocks deletions
  and direct edits.
- A cut is `PUT /mcp/content/current` with one key. It is gated on a fresh
  passing verdict for that exact sha. Verify on the archive URL; never cut
  to check.
- Doctrine (`VISION.md`, this file, `.pi/**`, `.brain/resources/*`) is
  read-only for the loop agent. Propose changes in a critique; Joel or a
  director applies them with `CINEMA_ROLE=director`.
- Public and private split: no private topology, credentials, or system
  Brain content in published artifacts, R2, the gallery, or repo issues.
- Built bundles never enter git; they live on R2 through the archive
  scripts.
- Effect is v4 at `4.0.0-rc.112`, one major across the workspace, pinned in
  `pnpm-workspace.yaml`. Bump effect and alchemy together or not at all.
- xstate v6 alpha is pinned with caretless exactness; bump deliberately.

## Completion

An iteration is complete when a ledger row exists for it. A study is
complete when a `cut` row exists for a sha with a passing verdict and a
critique that names the next variable. There is no daily completion; the
loop runs until `/loop off`.
