---
name: iteration-loop
description: Run one iteration of the cinema loop end to end (pick one variable, build, archive, verify with the critic, cut or record the fail, start the next). Use whenever you are the loop agent in this repo, whenever state/loop.json says mode loop, and whenever a Loop tick message arrives.
---

# Iteration loop

One iteration is the unit of work. It takes under thirty minutes, changes one
variable, and ends with a ledger row. It never ends with the agent idle.

## 0. Orient (two minutes)

- `.brain/resources/direction.svx` first. It is the only channel for orders.
- `cat state/loop.json` for the active study and the last verified and cut
  shas.
- `tail -n 5 state/ledger.jsonl` for what the last iterations tried.
- Newest file in `state/verdicts/`: read `operationVisible` and `floor`. The
  critic's last complaint is your next variable unless direction says
  otherwise.
- `.brain/resources/study-queue.svx` for the queued question and
  `.brain/resources/art-direction.svx` for the floor, the Material rule, and
  the provocations. Read; do not edit.

## 1. Choose one variable

Say it in one line before touching code: "this iteration changes X,
expecting Y in the 16s frame." Legal variables: a material or shader
parameter, the in-point, a delay, a surface's geometry, a light, a palette,
the camera path, the source clip. Illegal: several at once, or
infrastructure unless the previous verdict failed on infrastructure
(capture failed, frames byte-identical, mount missing).

## 2. Build from the shipped file

A new study file starts as a copy of the last shipped study's file, and the
first commit changes one thing. Probes keep the study's in-point and
viewpoint so their frames compare with cut frames. When something will not
render, bisect with a solid magenta material before tuning any number.

## 3. Archive

```bash
pnpm turbo run check test build
node scripts/archive-ship.mjs <sha> <study> "<one-line note>"
node scripts/upload-archive.mjs
```

Wait for `https://cinema.wzrrd.sh/archive/<study>/<sha>/index.html` to
return 200.

## 4. Verify with the critic, never with your own eyes

Call `cinema_verify` with the study and sha. It captures 5s and 16s frames
in an isolated browser and runs the vision critic. Read the verdict. If the
frames are byte-identical or the capture failed, that is an infrastructure
fail: fix the mount or the seek, then verify again.

## 5. Cut or record

- PASS: `cinema_ledger_append` a `cut` row, then cut the pointer with
  `node scripts/make-cut.mjs <study> <sha>` piped to the PUT. The extension
  refuses the cut without a fresh passing verdict for that sha. Write
  `critiques/<study>-<sha>.md`: quote the verdict's `operationVisible` line
  and name the next variable.
- FAIL: `cinema_ledger_append` a `fail` row naming the variable and the
  failing gate. Change the variable. After three consecutive fails on the
  same variable, change the variable class. After six on the same study,
  append a `parked` row and start the next queued study.

## 6. Start the next iteration

Go back to step 1 in the same turn. The extension kicks you if you stop; do
not make it.

## Budgets

- One iteration: under thirty minutes wall time.
- One study: at most twelve iterations before it is cut or parked.
- Sources: no clip for more than three consecutive studies; the catalog and
  the ingest pipeline exist for this.

## Blocked, by the extension

- A cut without a fresh passing verdict for that sha.
- Any ledger write other than `cinema_ledger_append`.
- Edits to `VISION.md`, `AGENTS.md`, or `.pi/**`. Propose in a critique.
- Hook bypass.
