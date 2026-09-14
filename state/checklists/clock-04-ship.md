# clock-04 ship checklist (cadence-open: 2026-09-15, ≥00:00Z)

Scheduling of the producer is Joel's boundary; manual maker passes are the
maker's own cadence. Ship inside a normal bounded pass.

## Pre-flight done (2026-09-14)
- [x] research chain: research/2026-09-14-clock-04.md (+ durable-trace requirement from the dream check)
- [x] core: cut-detection, ring-capture, intervention-trace (+ ring-capture collision detector) — 36/36 tests green (as of 2026-09-14; re-run full count at ship)
- [x] module: apps/sketch/src/lib/study-clock04.ts — committed UNREGISTERED (741ec37), turbo green
- [x] subtraction honored: pointer raster panel gone; wipe band gone

## Ship-morning sequence
1. [ ] Registry-add: apps/sketch/src/main.ts — `"clock-04": () => import("./lib/study-clock04"),`
2. [ ] pnpm turbo run check test build (full green)
3. [ ] Deploy worker (ALCHEMY_STAGE=prod chain, secrets leases)
4. [ ] node scripts/archive-ship.mjs <sha> clock-04 "surface as sculpture — past torn out at the film's own cuts"
5. [ ] node scripts/upload-archive.mjs + 200 check /archive/clock-04/<sha>/index.html
6. [ ] Pointer cut to clock-04@new-sha via MCP PUT with `archive: /archive/clock-04/<sha>/`
       — make-cut.mjs refuses a cut whose archive target 404s (the b03234c-look3 bug
       class), so steps 4–5 MUST precede this. No cutover happens yet — pointer cut
       moves the LIVE tip; see step 7 verification gate.

       Order statement: steps 4–5 (archive upload) come BEFORE the cut (step 6); the
       cut itself comes before browser verification only because verification IS of
       the live surface the cut moved. If step 7 fails, re-point clock-03 and the
       archive of clock-04 remains for a second attempt (≤2 repair attempts total).
7. [ ] Browser verify ≥3 frames / 90s watch: shard visible from boot trace, tears out at a film
       cut (watch `clock04.shard {source:'cut'}`), decays ~6s+2s back into the plane, memory-panel
       lag intact, zero console errors
       — Aids: console filter `clock04.|error` for the two discovery events
       (shard `{at, source:'cut'}`, intervention `{sha, source:'pointer'}`);
       frames at t≈+10/45/90 with the tip on the fresh pointer; the trace
       holds ~6s with ~2s quad decay — catch it right after a film cut.
       — NO-CUTOVER GATE: keep clock-03 pointed until this step passes.
8. [ ] Commit explicit paths; truthful ledger row (lineage: branches clock-03-b03234c)
9. [ ] message_shitrat kind=link
10. [ ] Critique with the local-eye pass (two frames to Qwen2.5-VL; quote + written disagreement)
11. [ ] (folded into 7's NO-CUTOVER GATE)

12. [ ] og-image refresh (POST-cutover only): capture a live clock-04 frame
       (≥3 in, stable) at 1200x630, replace apps/sketch/public/og-image.png,
       redeploy assets, verify the og URL returns the NEW bytes (hash
       compare) — the current card shows the stale clock-01-labeled knot
       (finding receipted 2026-09-14 11:41Z; three studies behind the tip).
