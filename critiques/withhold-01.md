# withhold-01 — ship critique (AD seq-37/38 protocol)

**Date:** 2026-09-15 early DAY 3 · **Study:** withhold-01 · **Candidate:** `cb43c9a` (archive-verified) · **Chained:** `research/2026-09-14-withhold-01.md`

## Evidence of record (all frames from `/archive/withhold-01/cb43c9a/?audit=1`, fresh browser, o11y-anchored)

| gate | frame | o11y anchor |
| ---- | ----- | ----------- |
| closed state | `critiques/withhold01-6s.png` | taken ~5s after mount (`00:41:27.25`); aperture fired `00:41:36.24` (mount+9.0s) — frame is **pre-shutter** |
| open state | `critiques/withhold01-16s.png` | taken ~16s after mount, 7s past the shutter; `withhold01.aperture {at: 63.25, via: seeked}` |
| relation (c) | `critiques/withhold01-30s.png` | taken ~27s after mount; beam lit, film running, ring trace visible |

Earlier `withhold01-closed.png` / `withhold01-open.png` are from the 9628a5c validation pass (same states, o11y-anchored in chat).

### Gate 1 — did the two frames differ (was there real change)?

**YES.** Closed → open is a cut, not a fade: the 6s frame is a dark plate inside an
unlit ring with projectors dim and **no beams anywhere**; the 16s frame has the film
running on the curved plate, a lit beam crossing the room, and the iris ring in its
fading trace. The 30s frame differs further (loop position, wall band). More than
the film changes: the whole room's light state changed at the shutter.

### Gate 2 — is the source card visible / context honest?

**YES** (in the sense this gate asks): the withheld state contains **no card and no
spinner** — a closed aperture with its ring, not a loading screen. The film's own
credit card does appear on the plate *after* the shutter (16s frame, "FREDERIC
ULLMAN JR." credit), which is genuine footage at t≈63s playing forward — the image
arrived and is being itself.

## The one-shot withhold (fixed per AD seq-37)

First cut (8971569) fired the aperture **51ms after mount** via backstop — the
closed plate never read. Fixed: `seeked`/backstop now **arms** the aperture
(`withhold01.armed` event); the shutter opens at **mount+9.0s, exactly**, only when
armed (verified twice: 00:26:30.5 and 00:41:36.2, both mount+9.00s, both
`via=seeked`). The closed state is authored, deterministic by construction.

## Rail-bubble audit (AD seq-38)

- **Offline math** (full 48s loop, 480 samples, distances to every beam-slice
  segment built from the real landing geometry): **min 4.62m** (beam 0), **min
  4.82m** (beam 1). Passes the ≥3m assertion with margin.
- **Runtime**: `withhold01.rail.audit` event added — per-load minimum distances
  logged after the first loop, `pass` boolean. (First loop not yet completed in a
  watched load; the closure evidence above spans the first 30s where the AD saw
  v18's failure at 18s — the 16s and 30s frames here show no beam entry.)

## Floor lines

| line | status | evidence |
| ---- | ------ | -------- |
| 1 film not card at open | pass (after shutter — before shutter the correct state is NO film) | 16s/30s frames |
| 2 apparatus visible | pass | projectors + plate + ring in all three frames |
| 3 motion in first 5s | marginal-but-authored: the withheld hold is a SLOWED state (iris breathing 0.55–0.65), then the shutter cut. The study DECLARES the stillness: the boundary is the operation |
| 4 screen largest / no beams before | pass | 6s: beams dark; 16s/30s: beam crosses but screen stays the subject; rail audit ≥4.6m |
| 5 room not slab | pass at all three sampled times | frames attached |

## Verdict: retain, cut `cb43c9a`

## Next iteration starts here (seq-22)

The ring audit must be WATCHED completing a full loop (`withhold01.rail.audit` with
pass=true) before the five-load determinism guard of the brief is satisfied. If the
audit ever reports pass=false, the failing rail segment is the very next fix — no
camera tuning by eye.
