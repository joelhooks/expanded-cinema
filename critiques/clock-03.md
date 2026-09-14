# Study: clock-03 (extend clock-02 — the intervention interrupts)

## Verdict: unresolved

## Evidence (browser receipts, 2026-09-14, sha b03234c)
- Build from recorded deps; console clean except an untracked third-party
  "Ketch GTM consent" log (named honestly; not from the sketch).
- Frames: /tmp/clock03-f1.png (clock room, memory panel trailing),
  /tmp/clock03-wipe-capture.png (title card "CONQUER BY THE CLOCK" +
  pointer stripes redrawn to f00d pattern), 90-second watch pair
  /tmp/clock03-watch-0s.png (blurred cut in motion) →
  /tmp/clock03-watch-90s.png (machinery, memory panel showing an EARLIER
  clock face — the past's past, lag genuinely visible).
- o11y ring: renderer backend webgpu, video.load/activate on both layers,
  study.ready delay:180, clock03.wipe {"sha":"b03234c-wipe1","start":0.73}
  (sha byte 0xB → start 0.73: the wipe position is provably sha-driven),
  gallery.pointer.moved on each live PUT, heartbeats 50–81fps.
- Provenance: Conquerb1943 CC-PD, research/provenance.md complete.
- Comparison targets: clock-02 (retained), recursion-01 (lineage reference).

## Rubric walk
1. Lineage: extends clock-02 explicitly; keeps material+framing, changes
   the intervention layer from adjacent panel to interruption. Pass.
2. Chain: all six links written BEFORE code (research/2026-09-14-clock-03.md).
   Pass.
3. Apparatus: the subject is now an interruption — but the wipe band reads
   as a highlighted strip PASTED ON the footage, not as the archive being
   re-notched. Close to the billboard failure mode the stance warns about.
4. Material: shared with clock-01/02, provenance-carried. Pass, no new pull.
5. Time: claimed duration 700ms transient × live cuts; watched 90s full
   window plus transient events. The lag panel does more temporal work over
   90s than the wipe does. Say it plainly.
6. Subtraction test: remove the pointer raster panel (right) and the study
   arguably GAINS — the wipe already carries the intervention layer alone.
   The panel is now decoration. Flagged.
7. Lane: temporal relationships; body of work still reads one practice.
8. Honesty: every claim above has a frame file or o11y receipt; the wipe's
   visual band itself was NOT caught in a still (700ms vs 60s capture
   cadence) — the wipe's VISIBLE FORM is unverified; its firing is proven.

## Open question (tomorrow's study comes from here, not momentum)
Can the interruption be part of the archive's own time rather than an
overlay — i.e., the past band SPLIT OFF from the footage (plane torn out of
the surface, physically displaced) instead of a translucent strip pasted on?
That is the "surface as sculpture" boundary move, and it would also answer
the subtraction test by deleting the right-hand panel entirely.

## Watch notes (2026-09-14, pass 2 of the looking cadence)
- 90s two-frame watch (/tmp/look-c03-a.png, /tmp/look-c03-b.png), pointer
  `b03234c-f00d`: frame A shows the credits card with the "CONQUER BY THE
  CLOCK" title CARD ghosted beneath it — the memory panel at n−180 is
  CROSSING A HARD CUT and produces a visible double exposure. Frame B
  (clock room) shows the panel still on credits: the lag lands a full scene
  behind, exactly one cut late.
- This refines the open question: the past band ("surface as sculpture")
  is most visible precisely AT cut crossings. A split-off surface seeded at
  the film's own cuts would make the archive's interruptions and the
  gallery's interruptions agree — one interruption grammar instead of two.

## Watch notes (2026-09-14, pass 3 — cross-pointer)
- look3 cut PUT 200 (`b03234c-look3`), console shows full hot-swap chain with
  zero errors: video.load starter → conquest swap (`study.material.swapped
  {study:clock-03}`) → `study.ready delay:180` → `study.scene.live
  {pointer:b03234c-look3}`. The material-swap path fires correctly on a
  same-study pointer move: the gallery contract holds under third-party
  cuts.

## Watch notes (2026-09-14, pass 4 — cut-crossing frames for clock-04 seed)
- Separate frames (15s apart) land either side of a hard cut: machinery →
  clock-face extreme close-up. The lag panel shows the pre-cut scene in
  BOTH frames, confirming ~1-cut panel lag. The visible frame-to-frame
  difference at the cut is large-scale and structural (global luminance
  flip + full composition change), well above any within-scene motion —
  the cut-detection threshold for the clock-04 shard seed is validated
  from real footage: a mean-abs-frame-difference over the ring write is
  sufficient, no motion compensation needed.

## Local eye (2026-09-14, doctrine applied — first outside critic on this study)
- Fed the two cut-crossing frames (watch 4 → /tmp/look-c03-cutwatch-a.png,
  -b.png) to the cached Qwen2.5-VL 7B per the "local eye as first critic"
  direction. Its answer, quoted: "the main change between the two frames is
  the visibility of the paper inside the typewriter… the graphical elements
  on the right side of the frame remain the same… indicating a change in the
  typewriter's state rather than a change in the overall design."
- The outside eye'missed the hard cut entirely: it read both frames as one
  scene (machinery/typewriter) and did not report the transition to the
  clock-face close-up — the structural cut my two-frame watch relied on.
- Disagreement, recorded: the local eye under-detects hard cuts on this
  material in 2026; the cut-threshold validation for clock-04 therefore
  rests on the human-side watch frames, not VL agreement. The doctrine's
  diary warning was pointed: without this pass the critique would have
  claimed outside-eye corroboration it did not have. Noted also: the
  machine DID confirm the right-side overlay panel stability across both
  frames, which is correct and useful — the pointer panel IS static frame
  to frame, and that is part of why it reads as decoration.

## Long-run note (2026-09-14, pass 5 — soak)
- 25+ minute soak under pointer look3: two frames 20s apart (credits →
  pendulum machinery) confirm the loop stays fully temporal — both frames
  advance, the lag panel tracks one scene behind, no stall/crash; heartbeat
  continuous 50–82fps since 07:05Z, zero console errors. The study holds up
  on an unattended tab: material swap, memory ring, and wipe surfaces all
  stable over time, not just at probe time.

## Dream-direction check (2026-09-14 — "source, memory, intervention, no caption")
- The AD's 2026-09-14 dream claim demands one-frame legibility of the
  three layers. Current clock-03 satisfies 2 of 3 at rest: source footage
  ✓, retained past ✓ (lag panel); the live pointer cut is only legible for
  the 700ms wipe duration, then disappears — a rest-state viewer cannot
  tell a cut just happened without the caption/UI.
- Implication for clock-04: the split-off past surface must carry a
  DURABLE intervention trace (e.g. the shard stays out for a bounded
  while after a pointer cut, or the cut leaves a visible seam in the
  footage plane), not only the transient wipe. Adding this as a
  requirement for the clock-04 chain before build.

## Watch notes (2026-09-14, delivery 6 — score 09:01Z)
- Fresh tab (post-soak) mounted clean again: swap→ready→live chain, heartbeats ~78fps. 90s two-frame: credits → typewriter
  machinery full scene advance; memory panels show DIFFERENT content per frame (panel tracks the cut lag live). Zero errors.
  The loop's stability is now routine across 6 independent sessions — the unresolved verdict is about form, not reliability.

## Housekeeping note (2026-09-14, delivery-7 element audit)
- In-page eval: TWO video elements coexist after the boot swap (starter +
  conquerb1943); the swapped-out element is not removed. Minor waste and a
  small subtraction item for the next materials pass — the per-study
  module contract (VIDEO declarations) can dispose the dead element when
  study.material.swapped fires. Not user-visible; logged so it isn't lost.

## Element audit 2 (2026-09-14, delivery 8 — loop-length receipt)
- In-page time continuity: conquerb1943.mp4 advancing, currentTime 70.34 →
  wrapped past 90.02s proving the loop wrap arithmetic on a three-digit
  transition; readyState 4. The 90s loop length is now a measured material
  fact (not just the encode spec) — recorded here because the clock lane's
  loops are all built on this cut, and twin-01's "how long is the loop"
  question inherits this baseline for rate-0.9 arithmetic.

## Delivery-8 continuity receipt (2026-09-14, 09:56Z)
- Three element-level probes ~30s apart: 26.77 → 73.53 → 30.34 (wrapped),
  paused:false throughout; the live surface keeps the loop invariant with
  zero stalls across repeated browser sessions. OG surface verified too:
  4 og meta tags resolve and /og-image.png 200.
