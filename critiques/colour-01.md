# colour-01 — critique (2026-09-15, final cut 5f8b65f)

Verdict: RETAIN as the first colour study; live.

What happened (chain 9fdd82f → 5f8b65f): verbatim-copy method (AD seq-43)
settled the "node material double-import" theory — the from-scratch scene
was the fault, not the import graph. Proven in order: gradient colorNode on
the plate (c01f), film through the node at 0/0/0 (c01g), drift-locked delay
line (three decoders: main, g=−3.0s, b=−6.0s), magenta probe
abs(R−B)×6 (AD seq-49), lights ×10 with ACES cap, tinted beams
(seq-51), and finally the seq-64 root cause: the in-point hard guard
re-seeked every frame, restarting the seek forever (rs pinned at 1) and
starving the whole pipeline at colourStep's readyState<2 gate. One
vstate diagnostic (seq-53's order) caught it; fix waits out `seeking`,
fires at most once.

Bar check (dazzle): 5s frame = saturated RGB separation on the plate over
moving machinery — the first stranger-stopping frame of the project. 16s =
tinted per-channel beam sheets, wall picture legible (frozen gun-rack while
the plate advances = the withheld past), palette wash across the floor.

DECISION — the withhold beat is DROPPED here, deliberately. colour-01 is
colour-as-time: the operation (three channels at three times) needs the
picture from first paint, and a 9s matte would hide the very thing the
study is about. The closed-aperture discipline stays alive in the
withhold-01 lane (9cb8ac9 live for that purpose last night) and returns in
a study where withholding *is* the operation, not a costume. Said plainly:
colour-01 opens at first paint.

Carry-forward (not fixing now per AD"):
- wall capture truth: the shutter lands in a legitimately dark stretch;
  brightest-seen fallback commits the best frame — a future iteration could
  choose an in-point that opens on a bright, high-motion frame instead.
- arm/seek guards are one-shot now; every future study that seeks must use
  the same pattern (races in both arm and seek paths cost this chain six
  builds).

Next: wallform-01 (built, archived at 0351b34) — verify 5s/16s via batch
method, cut if the picture reads across the shard heap.
