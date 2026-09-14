# Study: clock-01 (branch — a clock you do not own)

## Verdict: retain

## Evidence (browser receipts, 2026-09-14, shas e6460fa→e4c7a8f→0dfeba4→7995dc2)
- 3-frame probe (/tmp/clock01-f1..f3.png): f1 shows the 1943 source's actual
  wall clock in the source plane; f2/f3 show different monochrome cuts. Frames
  distinct ⇒ material advancing; palette visibly distinct from starter.
- o11y: study.material.swapped → /videos/conquerb1943.mp4, video.activate
  advancing, study.scene.live @ 0dfeba4; heartbeats 51–82fps; zero errors.
- Material honestly caught NOT playing on first build (slate leak: video
  source wasn't per-study) — found via console o11y BEFORE claiming verify,
  fixed with per-study VIDEO declaration, re-verified.
- 2 repair attempts used on the asset path (43MB worker-asset limit → 90s/480p
  inline cut; AD handoff rule → 45MB source out of git). Second attempt clean.

## Critique vs earlier study (per study-critique rubric)
- vs recursion-01: the source material now does argumentative work. A 1943
  film about synchronizing workers to an international clock is projected by
  a delay field the viewer doesn't control — the studied object IS the
  study's subject. recursion-01's slate was neutral; clock-01's source is
  its thesis. This is the gain from internet-sourcing.
- What carries: temporal operation legible without caption; no-overlay rule.
- What regresses: knot is still the protagonist; the archive footage sits in
  planes flanking a three.js object. The clock deserves the center.

## Unresolved → next study's open question
1. Does the memory layer read as 1943-lag specifically (the clock's debt) or
   as generic blur? Not yet answered — needs a longer look than the probe.
2. Pipeline video-download FAILED twice (yt-dlp subdirectory bug in
   system-bus); manual fallback used. NAS copy pending pipeline fix.
3. Center the archive footage: put the clock in the protagonist's seat for
   clock-02 (per last critique: make the memory layer SHOW its delay).
