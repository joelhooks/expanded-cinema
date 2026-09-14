# clock-04 — v21 thread verdict (AD seq-34 protocol)

**Date:** 2026-09-14 late DAY 2 · **Decider:** maker, on attached frames · **AD awaits**

## Frames compared (all from archive URLs, fresh browser, not the live pointer)

| version | 6s frame | 16s frame |
| ------- | -------- | --------- |
| v18 `fa72e9a` (shipped) | `critiques/v18-6s-archive.png` | `critiques/v18-16s-archive.png` |
| v21j `e5d7dee` (candidate) | `critiques/v21j-6s.png` | `critiques/v21j-16s.png` |

## What the frames show

- **v18 @6s**: giant striped sheet across mid-frame blown to near-white, RKO "CONQUER" title card visible but small and behind the slab, projectors half-occluded. Card race also present (title card at 6s — line 1 marginal).
- **v18 @16s**: the film IS on the curved screen (conquer footage), delayed beam crosses as a textured striped sheet in front, screen readable — this is why AD passed line 4 on v18. The beam still covers roughly the lower half of the frame.
- **v21j @6s**: beam now translucent/structured (slice banding visible, no whiteout), screen top-center-right with dark footage, projectors visible. Beam area still ≈ screen area.
- **v21j @16s**: room reads BLACK with the striped past-beam sheet huge in the foreground; the curved screen is a small strip at top showing legible film (countdown clock). Beam > screen by a wide margin — line 4 fails from this angle.

## Floor-line comparison (worst frame of each, per seq-27)

| line | v18 | v21j |
| ---- | --- | ---- |
| 1 film on screen not card | marginal (card semi-visible @6s) | pass | 
| 2 apparatus visible | pass | pass |
| 3 motion in first 5s beyond cuts | marginal (camera fixed; only film moves) | pass (rail drifts in the 7s hold) |
| 4 screen largest / room not slab | pass | **fail** (@16s beam dominates, screen a strip) |
| 5 fill the frame / room not void | pass | marginal (@16s black void left) |

## Verdict

**v21j does NOT beat v18.** It fixes the whiteout (the actual v20 disaster) but loses line 4 —
the 16s frame is the striped sheet with a screen sliver, while v18's 16s frame keeps the screen
as the subject. Per AD seq-34: stop tuning clock-04, **leave v18 as the shipped study**, and
start the next question from this critique.

## What the v21 thread banked (durable, carry forward)

1. **THE geometry bug (v21f):** slice/slat quads had `BEAM_LEN` baked into base geometry and
   were scaled by throw length — every sheet was ~3.4× over-length, overshooting the projector
   and punching through the screen. Any future beam work must use unit-length quads.
2. **Slat stack (v21b):** 16 slats was a coplanar additive stack at the beam midpoint;
   distribute along the axis.
3. **One-shot reveal (v21):** reveal/event re-assert loops that fire forever pin the video;
   every loop needs a guard that dies once its goal is met.
4. **Grazing-angle attenuation + normal-blend sheets (v21c/d):** thin additive quad sheets
   viewed edge-on stack ~N slabs per pixel; keep these in the toolbox for any study.
5. **Archive-URL-first checking (AD seq-33, binding):** candidates are judged on
   `/archive/<study>/<sha>/` frames, never by cutting the pointer to "check live".

## Next question (from this critique, per seq-22)

Line 3 was the marginal line on v18: "only the film changes in 10s". The queued
"image withholds itself" brief and the stance page's "the beam is the film" both target
exactly this. Start the next study chain there — do not touch clock-04 unless a floor line
breaks. Screenshots attached above; ledger rows to follow.
