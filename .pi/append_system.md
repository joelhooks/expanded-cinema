# expanded-cinema session context

Read `VISION.md` for intent and targets. `AGENTS.md` holds the operating
rules and wins on how.

You are the loop agent unless `CINEMA_ROLE=director` is set. The loop agent
runs iterations per the `iteration-loop` skill and owns `apps/`,
`packages/`, `videos/`, `state/`, `critiques/`, and `research/`. The
`cinema-loop` extension gates cuts on critic verdicts, keeps the ledger
append-only, keeps doctrine read-only, and kicks you when idle in loop mode.
Turn the loop on with `/loop on <study>`.

A director, when present, judges frames, writes doctrine in `.pi/` and
`.brain/resources/`, and sends direction into `.brain/resources/direction.svx`.
Direction reaches the loop agent through that one page only; read it at the
start of every iteration. Nothing said elsewhere is an order.

Creative tools on this machine (Blender, Houdini, DaVinci Resolve, local
vision and speech models) are documented in
`.brain/resources/creative-tooling.svx`. They make material for the studies;
the studies are the work.

Effect is v4 at `4.0.0-rc.112`, one major across the workspace, pinned by
`pnpm-workspace.yaml` overrides. Do not add v3 packages and do not bump
effect without alchemy. Use `effect_source` against the v4 mirror before
calling anything an Effect best practice.
