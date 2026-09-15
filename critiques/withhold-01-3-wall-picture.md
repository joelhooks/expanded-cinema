# withhold-01.3 — the wall holds a legible picture

AD seq-40/41: the wall "snapshot" must read as a picture at the same luminance
order as the screen, positioned in-frame from the opening viewpoint, in a
single frame with both surfaces readable and visibly different.

## What was wrong in .2 (d82ac97)

The wall beam landed the *frozen shutter bands* (mean-luma stripes) on the far
wall at x 2.2..4.3, z −7.55. Stripes are not a picture. The AD called it
correctly: faint grey band, not legible.

## The two probes (AD's cheap-first rule, seq-41)

- **666e2e0** — wall plane solid magenta at (1.45, 1.3, −7.4) rot.y 0.12:
  **NO magenta in two loads** → placement, not texture. The far-wall position
  renders nothing from the opening rail (out of frustum / shallow-angle wash).
- **5a6e628** — magenta at (2.3, 1.3, −2.0) rot.y 0: **solid magenta, right of
  screen** → position proven before any texture work.

## .3 (9cb8ac9)

- Wall picture = a real picture plane: 256×144 canvas captured inside
  `openAperture` (the exact shutter frame), `CanvasTexture` on a 5.0×2.8 plane
  at (2.8, 1.5, −2.0), facing the opening rail — the magenta-proven spot.
- Color setScalar(1.7): shutter frames are dark (snapshot mean ≈ 45–51/255),
  overdrive makes the past read at picture luminance.
- Fades in at openMs ≥ 3s (the wall arrival lag .2 introduced, kept).
- Freeze proof in-page: `withhold01.wall.proof` samples snapshot mean at
  capture, +10s, +20s — **45.42 / 45.42 / 45.42** → the wall is frozen by
  construction, not by luck.

## Gate: both surfaces in one frame

- `critiques/wh03-bothfinal-15s.png` — screen: live face (footage moved on);
  wall: frozen film-leader "2..1" numerals. Two readable, visibly different
  pictures.
- `critiques/wh03-bothfinal-late.png` (+27 min, second loop) — screen: credits
  roll "FREDERIC ULLMA…"; wall: **identical** "2..1" leader frame. The wall did
  not move while the film lived on. The withhold endures across loops.
- `critiques/live-9cb8ac9-cut.png` — live cinema.wzrrd.sh after the cut:
  `scene.live pointer=9cb8ac9`, aperture via seeked at mount+9.0s, frozen
  "12..1" dial image on the wall against the live screen.

## Cut

Live pointer: withhold-01@d82ac97 → **@9cb8ac9** via
`PUT /mcp/content/current` (see footgun row seq-46 in the ledger:
`PUT /archive/content/current.json` silently 200s and returns the old document
— always cut via the `/mcp/` endpoint).

## Open edges named, not smuggled

1. The wall picture's position/z is proven empirically (magenta), but it sits
   in front of the back wall plane — physically it floats mid-room; whether
   that matters visually is an AD call.
2. `withhold01.rail.audit` ran `pass:true` this session but `minD0/minD1` came
   back null in the observed event — the audit's distance fields don't
   populate on the first full-loop pass; worth one look before withholding
   work continues.
3. The wall holds the shutter frame indefinitely; a lagging twin tracking
   `bandAt(180)` (standing offer from .2's critique) remains a one-line swap
   if the AD wants decay instead of endurance.
