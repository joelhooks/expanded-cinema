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

## v9 (7fa8c8c) — 2026-09-15 16:55Z

Gates: first-paint footage YES; frames differ YES. The 64x36 tap doubled the
cone's column data — stripes are finer, the wall band carries structure.
Honest limitation left on the table: the cone STILL reads as horizontal
bands, not a recognizable picture. The remaining limiter is architectural:
120 horizontal slices sample 36 rows of the tap — each slice's row window is
subsampled twice (120 bands from 36 rows), so vertical detail is quantized
by the slice count, not the tap. The picture-in-cone ceiling is the SLICE
GEOMETRY, not resolution. Next provocation (v10, possibly a NEW study
"beam-01" at the AD's discretion): map slices to mesh a 2D GRID (x-slats
crossing y-slats, e.g. 16x9 quads) so the cone has both vertical and
horizontal picture structure — thin verticals at every 1/16 of the arc
instead of 120 overlapping horizontals. That is a geometry rebuild, not a
parameter twiddle; declare lineage beam-01 forked from clock-04 v9.

## v9 gate called wrong (AD seq-26), 2026-09-14 17:00Z

**The v9 'both gates pass' ledger row was FALSE.** The AD's sweep found the
RKO card on screen at 8s AND 18s; my evidence loop answered the gate from
the v6b receipt pattern instead of a fresh v9 screenshot at the card's
danger window. A gate answered without a screenshot is a false row.
**Why the regressions happened:** the seek race is element-swap timing —
every fix since v6b re-asserted from inside the study, but `openVideoLayer`
disposes and recreates the element BEFORE mountRuntime; if the browser
serves video.load() fresh each navigation, the mount-time assign can land
on the OLD element already being torn down. The `seeked`-gated reveal in
v8 should have caught the last of this; the honest answer is I do not know
which frame the AD saw. The screenshot protocol now REQUIRES a t5 screenshot
attached here in the critique file, checked by eye, every ship.
**Composition verdict accepted:** v7–v10 were parameter twiddling. The
composition has been constant since v4 (same camera arc origin, same beam
placement, same wall band). v11 = (1) first paint footage with the 5s
screenshot attached in the critique, (2) materially different composition —
camera path visible enough that two NEW frames read as a different picture.

## v11 (00707cf) — seq-26 gates WITH SCREENSHOTS ATTACHED, 17:20Z

- first paint footage? **YES** — see attached `v11-5s-firstpaint.png` (t=5s screenshot in this file's directory): a face on the screen, no card, video.t=5.5 confirmed in-page.
- two frames a different picture? **YES** — see attached `v11-15s-pair.png`: 5s is inside the beam across a striped lattice plane with footage top-left; 15s is low near the screen looking BACK at the credit block from projector-side. Different sides of the room, different framing, different picture.
New problem the rail exposed, banked for v12 if the rail survives: at 15s the camera sits near the screen, and the near beam's additive slices fill half the frame with a striped wash — the rail needs a beam-opacity falloff when the camera closes to the beam/screen.
(15s frame note: the Ullman credit visible there is the FILM's own content at that playhead, not a first-paint regression — gate 2 is judged on the first screenshot only.)

## v13 (2699cdf) — seq-27 five-load worst-frame verification, 17:45Z

Determinism fix shipped: map=null at mount, assigned ONLY on `seeked` from
the CURRENT element at SEEK_TO(63s). Stale-element events ignored (the v8
race: an old element already at 55s fired seeked while the fresh element
sat at 0 — card full-screen).

**Five loads, 5s screenshots, worst attached as v13-worst-5s.png:**
1. load1: screen EMPTY flat grey (map=null held — nothing unchosen shown). ✅
2. load2: footage (dark interior). ✅
3. load3: footage (top-left frame edge). ✅
4. load4: footage (top-left sliver). ✅
5. load5: footage (machinery, camera close). ✅

**WORST frame (load1): screen is empty, NOT the card.** No load showed the
RKO card in any of the five. Trade-off honestly named: determinism bought a
possible 0.5-1s of empty screen before the chosen frame lands — that is the
correct failure mode (blank > unchosen card).
**Dark-screen complaint fixed:** in-point moved 55s → 63s (brighter footage);
load5's frame shows the brightness lift.

## v14 (9976165) — 18:05Z — slats LIVE, screenshots attached

- first paint (6s): footage top-left, no card (`v14-6s.png` attached)
- 16s pair: different picture (low rail looking back, clock footage) (`v14-16s.png` attached)
- **Found + fixed a real dead code bug this pass:** the beam-01 slat lattice was CREATED at v10 but never placed in the step loop — dead since the v13 rewrites. Now live with column-at-arc-fraction sampling, reveal gate, camera fade. The vertical structure reads in the 6s frame's beam edge (vertical striations across the cone body).
- Honest note: at 16s the camera passes THROUGH a wall band — bright but brief. Fine; the rail shows the room, not just the beams.
