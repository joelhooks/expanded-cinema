# colour-01 — investigation state (AD seq-44..47), written 2026-09-15 ~06:35Z at 81% context

## Where the study stands
- colour-01 branches withhold-01.3 (9cb8ac9, cut live — the shipped study the
  gallery serves). colour-01 is NOT cut; live pointer stays
  `withhold-01@d82ac97`?? NO — live is `withhold-01@9cb8ac9` (colour-01.3's
  wall-picture build, cut at 03:29Z).
- The razzle bar (Joel, AD seq-41..43): full-bleed colour in the room, beams
  with weight, saturated fringes reaching the walls, frames at 5s and 16s that
  differ; "would a stranger stop at the 5s frame".

## What WORKS (evidence attached in critiques/)
- Coloured light genuinely lands: c01c-8s.png shows amber/teal falloff on the
  displaced floor, lens glowing, saturated swaying cones. Frames differ.
- The THREE-decoder delay line WORKS EXACTLY: o11y `colour01.drift` shows
  main / g = main−1.5 / b = main−3.0 locked (EMA <0.05s), split:true.
  Build sequence: 9fdd82f (rings version, doomed), b6d92c7 (decoder version,
  drift-gated, base-case first per AD), 28a689a (cone flip + mirrored UV
  inside node + luminance floor).
- The frame loop animates (sway, breath) — not frozen (AD seq-44 fault 3
  resolved in b6d92c7).

## The open fault: the plate renders BLACK through MeshBasicNodeMaterial
- Even a PURE procedural gradient colorNode (vec3(uv*2+0.15, uv*1.2+0.05,
  0.35) — cannot be black) renders black: c01d-probe.png, c01d-probe2.png.
- 53696f4 = gradient probe; 68cbb62 = fog-off probe (FogExp2 cleared — NOT
  the cause); 4134637 = placement receipt.
- Placement receipt numbers (o11y colour01.placement): platePos
  (0,1.55,-2.2); plateBoxMin (-2.81,-0.1,-5.6); plateBoxMax (2.81,3.2,-4.11);
  lens (-3.9,1.35,2.4); cam (0.4,0.85,5.9); inFrustum TRUE;
  materialType MeshBasicNodeMaterial; colorNodeSet TRUE.
- From the bbox z-span the curved plate actually sits at z ≈ −4.1..−5.6
  (CylinderGeometry arc wraps AWAY from +z after rotation.y=PI), NOT at the
  nominal -2.2. Cones were aimed at LAND (0,1.6,-2.2) = 3m in front of the
  plate = mid-air ends (AD saw exactly this).
- Why the withhold-01 plate LOOKS visible while colour-01's goes black is
  unresolved: same geometry constants, but withhold uses classic
  MeshBasicMaterial+map and colour-01 uses MeshBasicNodeMaterial.
- Current double-core suspicion: three.ts's `three/tsl` re-exports
  `TSL` from `three/webgpu` (verified in build/three.tsl.js: imports
  { TSL } from 'three/webgpu') so single-core — theory likely WRONG, or the
  pnpm resolve duplicates three copies for ts vs webgpu builds.

## AD seq-47 row (current build, in flight)
- study-colour01.ts is now a VERBATIM COPY of study-withhold01.ts (proven
  scene: plate/projectors/beam/rail all render correctly on the live site);
  THE ONE CHANGE = screen material swapped to `MeshBasicNodeMaterial` with a
  gradient colorNode (uv red-green ramp). Everything else untouched (SEARCH_TO
  shutter, wall picture, beams).
- DECISION TREE (AD's): gradient shows → put video+delays in the node, then
  coloured lights+cones. Plate black → node/material double-import problem,
  try importing TSL ONLY from "three/webgpu" namespace objects
  (THREE.Vec3Node? — or `import * as TSL from "three/webgpu"` and use
  TSL.texture/vec3/uv instead of "three/tsl").
- Next commit message MUST quote the placement receipt numbers (AD order).

## Receipts inventory (o11y events colour-01)
- colour01.drift {main,g,b,split,base} — delay-line lock proof
- colour01.baseLive / colour01.splitLive (in earlier shas; ring buffer may
  age them out fast)
- colour01.placement {platePos, plateBoxMin/Max, lens, cam, inFrustum,
  materialType, colorNodeSet}
- colour01.error {msg,err} — try/catch wrappers in step
- colour01.aperture / armed / arm.proof (renamed from withhold) — arrival

## Gallery ship gate
- Do NOT cut colour-01 until: 16s frame shows fringes on the screen AND
  cones landing on it AND 5s/16s frames differ. Archive previews are the
  judgment surface (AD seq-32/33 archive-URL-first law).
- fan of near-live evidence: watch `colour01.placement` numbers, never argue
  from a black frame alone.

## Context budget note
This file exists because AD seq-47 flagged 81% context. If compacted before
cut, resume from: `apps/sketch/src/lib/study-colour01.ts` (verbatim withhold
copy + gradient plate), `/tmp/init-c01.js` (pointer stub for preview),
`scripts/upload-archive.mjs` (rerun on JSON SyntaxError — idempotent).
