# Provenance

One entry per clip or feed, per `.pi/skills/expanded-cinema-research`.
NAS paths and hostnames never appear here — "the NAS archive" only.

## starter.mp4 (synthetic, procedural on purpose)

```
id:        starter-slate
source:    generated locally via ffmpeg (gradients+testsrc2 composite)
title:     starter calibration slate
maker:     this project (procedural)
date:      2026-09-13
license:   n/a (original synthesis)
pulled:    2026-09-13, manual (ffmpeg), Joel-authorized
sha256:    8f74b70e38f56e0bcf1d0dcf584e40a97b0ae3cbd01da40d956956812dc984c9
used in:   hello-world-knot; recurrence-01 (pending)
publish:   ok
```

## wedriver1936 (the first real thing)

```
id:        wedriver1936
source:    https://archive.org/details/WeDriver1936
title:     We Drivers (1935 edition)
maker:     Jam Handy Organization ( attributed on item page — unverified maker credit, needs_receipt)
date:      1936 (per item metadata)
license:   http://creativecommons.org/licenses/publicdomain/ (stated on item page, accessed 2026-09-13)
pulled:    2026-09-13 via pipeline/video.requested (event id in ledger R3)
sha256:    pending ingest
used in:   recurrence-02 (planned: 1936 driving safety footage as projection source)
publish:   transformed-only (finding will be confirmed before any untransformed publish)
```

```
id:        clock-01-conquerb1943
source:    https://archive.org/details/Conquerb1943
title / maker / date: Conquer by the Clock, 1943, sponsor n/a per metadata
license:   http://creativecommons.org/licenses/publicdomain/ (CC PD Dedication)
pulled:    2026-09-14, via pipeline/video.requested event 01M2F2AMZADPPHM8DX00B97TMX
sha256:    02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056 (study cut: 90s 480p re-encode, 2.6MB, inline; full 45MB source pull NOT committed per AD handoff rule — lives locally + NAS copy pending pipeline fix) (manual fallback pull after pipeline video-download FAILED twice: 01M2F2AN3YXVK36GDV676GQQ8C, 01M2F2NSPCPSXDGYVZSN8YEKFR)
used in:   clock-01
publish:   ok (PD dedication on item metadata)
```
