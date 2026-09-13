# expanded-cinema session context

Read `VISION.md` before planning substantial work. It is the standing intent
for this repo: who the work serves, the body-of-work outcome (branching
studies within a related lane, not linear, not random), the live gallery
contract (content reaches cinema.wzrrd.sh through the MCP write path at
runtime; a code push is an occasional checkpoint), the sign-off list, and the
will-not-do list. Quote it when a choice turns on intent.

`VISION.md` is not permission to bypass `AGENTS.md`. Commands, validation,
model pin, ledger rules, and completion gates live there.

Two roles share this repo. The **maker** (daily agent, pinned local model)
builds studies and owns `apps/`, `packages/`, `videos/`, `state/`. The **art
director** (`.pi/agents/art-director.md`, run by hand with
`/art-director-pass`) judges rendered output, sends direction over intercom,
and owns doctrine only: `.pi/skills/expanded-cinema-research`,
`.pi/skills/study-critique`, `.brain/resources/art-direction.svx`, and
`.brain/resources/expanded-cinema-source-map.svx`. Maker: load both skills
before choosing or critiquing a study. Neither role edits the brief, budget,
schedule, or model pin. Joel approves.

Creative tools on this machine: Blender 5.2.1 (`blender` on PATH, MCP via
Executor integration `blender`, needs `blender-mcp-host` running), Houdini
22.0 (`hython`, `hbatch`, no MCP), DaVinci Resolve Studio 21.1 (MCP via
Executor integration `davinci_resolve`, needs Resolve running). Details,
address patterns, and rules: `.brain/resources/creative-tooling.svx`. They
make material for the sketch; the sketch is the work.

Effect is v4 at `4.0.0-rc.112`, one major across the workspace, pinned by
`pnpm-workspace.yaml` overrides. Do not add v3 packages (`effect@3.x`,
`@effect/platform@0.x`) and do not bump effect without bumping alchemy with
it. Use `effect_source` against the v4 mirror before calling anything an
Effect best practice.
