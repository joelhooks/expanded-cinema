# Vision

Expanded cinema is a continuously running Three.js sketch agent. It researches
questions from roughly the last fifty years of expanded cinema practice
(projection, rephotography, remix, temporal relationships), turns each finding
into a WebGPU sketch, looks at what it actually rendered, critiques it, and
carries the judgment into the next one. There is no daily quota in either
direction: a study ships when its chain, critique, and ledger row exist, and
the gallery is expected to change often.

The output is a related body of work, not a linear evolution of one sketch and
not a random daily challenge. Studies bounce around inside a recognizable
thematic lane: variations, revisits, and branches that each say what they keep
from an earlier study and what they change. The gallery at
[cinema.wzrrd.sh](https://cinema.wzrrd.sh) is the public surface, and it is a
live one: the agent changes what the gallery shows through an MCP (Model
Context Protocol) interface, the page refreshes itself, and a code push is an
occasional checkpoint rather than the way a new study reaches viewers.

This document governs this repository. It is written for gallery viewers,
people interested in agent-made creative practice, and anyone who opens a
pull request. It is not an agent instruction file; operational rules live in
`AGENTS.md`.

## Who We Serve

- **Primary:** Joel, the artist-operator who sets direction, corrects the
  agent, and approves what counts.
- **Secondary:** people who visit the gallery, and people studying how an
  autonomous creative loop keeps memory, critiques itself, and stays honest.
- **Not for:** anyone looking for a Three.js starter kit, a generative-art
  template, or a daily-sketch challenge to fork.

## Outcomes

- A body of work that reads as one practice. Every study names its lineage:
  which earlier study it extends, revisits, or branches from.
- Every sketch carries an explicit chain: cited source finding, artistic
  question, Three.js operation, observable result to examine.
- The agent judges its rendered output over time, not its code, and that
  judgment changes future studies. Returning to an unresolved experiment
  counts as progress. Piling on effects does not.
- The work is made of light, colour, and volume. Each study chooses a
  palette on purpose, treats the projector as a light source that colours
  the room, gives its surfaces relief and depth, and writes its own shading
  in node materials. The renderer is a medium, and the studies should look
  like they were made in it.
- Runs are recoverable and truthful. The ledger says what happened, failures
  are preserved, and nothing is claimed verified without evidence.
- The gallery is live. Studies, previews, and lineage reach the site through
  the MCP write path within a run, and an open browser tab shows the change
  without a rebuild. Code ships by push only when the site itself needs to
  change.

## Current Priorities

1. Prove the starter end to end: build, browser-verified WebGPU render,
   deploy to cinema.wzrrd.sh, one review link, one report.
   Include the live loop: a runtime content store the page reads from, an
   authenticated MCP tool that writes to it, and proof that a change made
   through MCP shows up in an already-open page without redeploying.
2. Make the first researched study by hand. Then, in a fresh session, make a
   related second version that applies a saved correction.
3. Build one bounded producer: lock, per-pass dedupe, resumption, spend
   records, and a stop policy. Runs continuously once those pass.

## Actors

- **Owner:** Joel. Approves aesthetics, spend, schedule, and publishing.
- **The maker:** runs on a pinned local model. It proposes, builds,
  critiques, and records. Its proposals never silently become rules.
- **Contributors:** welcome for fixes, tests, verification, and research
  notes. Creative direction is not open for pull requests.
- **External systems:** Cloudflare (Workers and R2 through alchemy), the
  gallery's MCP write surface, wzrrd review links, the joelclaw bus for
  scheduling and reports.
- **Not an audience:** other projects' pipelines, cloud agent profiles, or any
  shared render queue. This project inherits nothing from them.

## Merge by Default

- Bug fixes with a clear cause and bounded risk.
- Tests and checks that encode existing behavior, including browser
  verification of real rendering.
- Documentation fixes that do not change policy.
- Small changes that follow the existing shape: Effect for sources and
  pipeline, XState for run and sketch lifecycle, WebGPU renderer.
- Research notes with real, verified citations.

## Needs Sign-Off

- Changing the model pin, the rendering backend, or a major dependency,
  including the XState alpha and Effect pins.
- Anything that publishes: a new public surface, hostname, what kinds of
  content the gallery can show, or a public run-history page. Individual
  studies reaching the live gallery through MCP within a run are the normal
  path and do not need sign-off.
- The MCP write surface itself: who can call it, how it authenticates, and
  what it is allowed to change. It is a publishing capability on a public
  site and is treated like one.
- Anything that spends: paid APIs, Cloudflare paid features, media-generation
  services, or GPU time policy.
- Enabling, changing, or unpausing unattended runs.
- Editing the user brief, permissions, budgets, or standing rules.
  Self-critique may propose these changes; it may not make them.
- Publishing an untransformed source clip on the gallery when its license is
  unclear. Pulling from the open internet for study and transformation is
  authorized; provenance and license are recorded per clip; the transformed
  study is the normal case and needs no sign-off.
- Fixing a visual language, or promoting any study as canonical.

## Will Not Do For Now

- Unrelated daily sketches where every day starts over.
- One master sketch that only evolves forward.
- Collapsing expanded cinema into a generic feedback shader or a single
  screen-installation form.
- Multi-agent orchestration or a forever loop. One bounded producer first.
- WebGL as the target. A fallback is reported, never silently substituted.
- A public run-history page. The site carries the gallery only.
- An external semantic memory as a second ledger. The project ledger is
  canonical.
- Decorative research: an artist's name beside output it did not inform.
- Rebuild-and-redeploy as the delivery path for each study. The site reads
  content at runtime; a deploy is for code changes.

## Decision Boundaries

- **Safe by default:** research, candidate sketches, critiques, new versions,
  local previews, draft reports, Brain notes, and publishing a finished study
  to the live gallery through MCP.
- **Needs owner sign-off:** the list above.
- **Evidence expected for a meaningful change:** a build from recorded
  dependencies, a browser-verified render over multiple frames (a single
  screenshot is not enough), a critique against an earlier version and a
  stable reference, a ledger record, and a live URL that returns HTTP 200
  with the expected content.
- **Budget and maintenance:** local inference is cheap at the margin.
  Cloudflare, paid APIs, and Spark GPU time are not blanket authorized.
  Unknown cost is recorded as unknown, not zero. At most two repair attempts
  per candidate, then preserve and report the failure.
- **Privacy:** no machine topology, credentials, or private notes in the
  repo, the gallery, R2, or review links.

## Amendment Policy

This document changes when evidence shows the direction or the boundaries are
wrong. The agent may propose amendments with receipts: a critique, a ledger
record, a cost record, or a source. Joel approves changes.
