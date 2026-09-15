# Vision: Expanded Cinema

> Status: the first experiment (`archives/expanded-cinema-2026-09`) closed on
> 2026-09-15. Its retrospective is `.brain/archives/expanded-cinema-retrospective.svx`.
> This vision is for what runs next in `apps/`.

## What this is

A long-running, self-verifying loop that makes projection studies in
Three.js WebGPU from real film and live material, judges each one from its
rendered frames with a vision critic, ships the ones that pass to a live
gallery, and starts the next one in the same breath. The unit of work is an
iteration of one variable, not a day and not a study.

## Who we serve

- **Primary:** Joel, the artist-operator who sets direction, watches the
  grid, and says when a lane is done.
- **Secondary:** gallery visitors who arrive cold and should stop
  scrolling; people studying how an autonomous loop can make and judge
  images without a human in every step.
- **Not for:** anyone looking for a Three.js starter, a generative-art
  template, or a daily-sketch challenge.

## Outcomes, measurable

Targets for a running week. The ledger and the verdicts directory are the
source of truth for all of them.

| target | measure |
| --- | --- |
| The loop runs itself | at least 24 scored iterations per day with no human message in the ledger; zero idle hours while `/loop` is on |
| The critic is the gate | zero pointer cuts without a fresh passing verdict for that sha (the extension blocks them; the count must be zero) |
| Work compounds | at least 30% of iterations pass the floor by the critic; every cut study names its lineage and its next variable |
| Material moves | at least three distinct source clips in rotation per week, each with a provenance row; no clip for more than three consecutive studies |
| The look grows | at least one new named style preset per week, with a source, in the deck; every study names its palette, light, relief, and node material before the build |
| The gallery is live and legible | the site shows the current cut and a grid of the last fifty iterations with frames and scores; a cold visitor sees a room, an apparatus, motion in five seconds, film as material, and colour |
| Truth holds | the ledger is append-only; every claim of "verified" points to frames on disk |

## What interesting means

The apparatus is the subject: screen, beam, surface, viewer, delay. One
source, one operation, one surface, one duration is a complete study. The
work is made of light, colour, and volume, rendered in node materials. Return
to an unresolved question counts as progress; piling on effects does not.
The floor, the gates, the Material rule, and the provocations with sources
live in `.brain/resources/art-direction.svx`.

## Actors

- **Owner:** Joel. Approves aesthetics, spend, schedule, publishing, model
  changes, and doctrine edits.
- **Loop agent:** a pinned local model. Runs iterations under the
  `iteration-loop` skill with the `cinema-loop` extension enforcing the
  gates. Owns code, state, critiques, and research. Cannot edit doctrine.
- **Critic:** a local vision model called through `cinema_verify`. Grades
  frames against the floor and the gates. Its verdict is the only evidence a
  cut accepts.
- **Director (optional):** a session with `CINEMA_ROLE=director` that reads
  frames and verdicts, pushes provocations, and writes direction into one
  page, `.brain/resources/direction.svx`. Not required for the loop to run.
- **External systems:** Cloudflare Workers and R2 through alchemy, the
  ingest pipeline for source material, the local vision model.

## Merge by default

Iterations, cuts with passing verdicts, critiques, research chains,
provenance rows, verdict files, new presets proposed in a critique, fixes to
keep the workspace green.

## Needs sign-off

Changing the model pin, the critic model, the verdict thresholds, the loop
budgets, the gallery's public surface beyond the pointer and the grid, the
MCP write surface, spend beyond local inference, and any edit to doctrine.
Publishing a clip whose license is unclear without transformation.

## Will not do, for now

- A human-in-the-loop verification step. If the critic is wrong, fix the
  critic prompt or model through sign-off; do not add a person.
- Cuts made to "check it live".
- Rebuilding playback, reveal, capture, or the rail per study. They are a
  library; a study is a material and a config.
- Unrelated daily sketches where every day starts over.
- Built bundles in git.
- Private topology, credentials, or system Brain content anywhere public.

## Decision boundaries

- **Safe by default:** everything under Merge by default.
- **Evidence for a change:** frames on disk plus a verdict file, and a
  ledger row. A commit message is not evidence.
- **Budget:** local inference is cheap at the margin; one iteration under
  thirty minutes; a study parked after twelve iterations without a cut.
- **Direction:** one page. Anything said elsewhere is not an order.

## Amendment

This file changes by owner sign-off, applied with `CINEMA_ROLE=director`.
The change is logged in `.brain/projects/expanded-cinema-decisions.svx`.
