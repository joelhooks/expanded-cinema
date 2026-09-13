# expanded-cinema session context

Read `VISION.md` before planning substantial work. It is the standing intent
for this repo: who the work serves, the body-of-work outcome (branching
studies within a related lane, not linear, not random), the live gallery
contract (content reaches cinema.wzrrd.sh through the MCP write path at
runtime; a code push is an occasional checkpoint), the sign-off list, and the
will-not-do list. Quote it when a choice turns on intent.

`VISION.md` is not permission to bypass `AGENTS.md`. Commands, validation,
model pin, ledger rules, and completion gates live there.

Effect is v4 at `4.0.0-rc.112`, one major across the workspace, pinned by
`pnpm-workspace.yaml` overrides. Do not add v3 packages (`effect@3.x`,
`@effect/platform@0.x`) and do not bump effect without bumping alchemy with
it. Use `effect_source` against the v4 mirror before calling anything an
Effect best practice.
