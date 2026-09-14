# clock-04 ship checklist (cadence-open: 2026-09-15, ≥00:00Z)

Scheduling of the producer is Joel's boundary; manual maker passes are the
maker's own cadence. Ship inside a normal bounded pass.

## Pre-flight done (2026-09-14)
- [x] research chain: research/2026-09-14-clock-04.md (+ durable-trace requirement from the dream check)
- [x] core: cut-detection, ring-capture, intervention-trace — 31/31 tests green
- [x] module: apps/sketch/src/lib/study-clock04.ts — committed UNREGISTERED (741ec37), turbo green
- [x] subtraction honored: pointer raster panel gone; wipe band gone

## Ship-morning sequence
1. [ ] Registry-add: apps/sketch/src/main.ts — `"clock-04": () => import("./lib/study-clock04"),`
2. [ ] pnpm turbo run check test build (full green)
3. [ ] Deploy worker (ALCHEMY_STAGE=prod chain, secrets leases)
4. [ ] Pointer cut to clock-04@new-sha via MCP PUT with `archive: /archive/clock-04/<sha>/`
       — NOTE (2026-09-14 fix): scripts/make-cut.mjs now refuses a cut whose archive target 404s; run steps 6–7
       (archive-ship + upload) BEFORE generating the cut, or make-cut will exit 2. The b03234c-look3 bug class
       (pointer → nonexistent archive dir, live 404 for viewers) is guarded at the tool.
5. [ ] Browser verify ≥3 frames / 90s watch: shard visible from boot trace, tears out at a film
       cut (watch `clock04.shard {source:'cut'}`), decays ~6s+2s back into the plane, memory-panel
       lag intact, zero console errors
6. [ ] node scripts/archive-ship.mjs <sha> clock-04 "surface as sculpture — past torn out at the film's own cuts"
7. [ ] node scripts/upload-archive.mjs + 200 check /archive/clock-04/<sha>/index.html
8. [ ] Commit explicit paths; truthful ledger row (lineage: branches clock-03-b03234c)
9. [ ] message_shitrat kind=link
10. [ ] Critique with the local-eye pass (two frames to Qwen2.5-VL; quote + written disagreement)
11. [ ] Keep clock-03 pointed until step 5 passes — NO cutover before browser verification
