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
