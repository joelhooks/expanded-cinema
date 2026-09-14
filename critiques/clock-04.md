# clock-04 — critique log

## v4 (8f2cfc5) self-critique, 2026-09-15 15:40Z — live two-frame receipt

**What a stranger sees:** a dark room. A wide silver cone of stacked slices
floods from the left; a blue-grey band crosses the right and dies into the
back wall; a curved grey panel mid-frame shows a film whose credits are
currently legible (Frederic Ullman Jr. — Slavko Vorkapich), warped slightly
by the cylinder. The cone's stripes shift with the film's luma. Between two
frames 11s apart everything breathes: the cone's apex drifts, the panel
slides, the wall band shifts.

**Verdict: unresolved — retains, not yet shippable as a "study complete."**

**Open question (drives v5):** the beams are stripes of the FILTER, not
stripes of the PICTURE. Each slice's brightness is that row-band's MEAN
luma — arrival at McCall's cone, but the image never travels in the air.
A stranger could not tell WHICH film is playing from the cone alone; only
the curved panel carries the picture. The next forward move (v5): modulate
each slice from a horizontal window of its band (band mean + column detail
at that slice's y-crossing sampled at 3 x-positions), so dark frame
regions read as dark patches IN the cone and the cut event flashes from
inside the beam. Secondary: the wall-wash is static in shape — let its
landing point drift with the delayed bands so the past moves on the wall.

## v6b (766c1c2) — seq-24 gates, 2026-09-15 16:20Z

- did the two frames differ? **YES** — /tmp/beam-v6b-t01.png vs -t11.png: cone apex moved, beam band changed, footage different.
- is the source card visible? **NO** — screen at t0+t10 shows aircraft/factory footage; video.t=80.9 (seek 55 held, film looped past 90).
Root cause of 3x card failure recorded: seek 120s > 90s duration clamped to loop. Critique rubric now carries both yes/no gates with screenshots attached.
Open for v7: near beam still washes the left third flat (alpha halved but additive stack saturates); picture-in-cone is band-mean+col-detail, still not identifiable as THIS film. Next provocation: sample the cone from the SAME canvas tap but at (row≈slice-y, col≈cone-x) so the cone IS the picture's footprint; kill the wall-wash if the cone carries enough image to fill the frame alone.

## v8 (58e5f94) — seq-25 gates, 2026-09-15 16:45Z

- did the two frames differ? **YES** (beam-v8-first vs -t11: cone, wall band, geometry all move)
- is the source card visible ON THE FIRST screenshot? **NO** — first paint is footage; screen held black until `seeked` confirmed 55s.
First-paint rule banked in the critique: gate 2 checks the first screenshot, not a later one. The seek event, not the assignment, is what makes it real.
Open question for v9 (from v8's own frames): the past beam on the wall now HAS per-slice structure but reads as horizontal stripes, not a picture — 32x18 is too coarse for the wall span it covers. Options: widen the tap to 64x36 (cheaper on CPU than it sounds; same drawImage, more pixels), or compress the wall span so each slice covers fewer columns. Watch whether the cone's col mapping (u spans only 0.14 of the screen) is the real limiter — the screen is a narrow sliver of the 32-wide tap, so the picture inside the cone is squeezed to ~5 columns of data. Widen the sampled window rather than the cone.
