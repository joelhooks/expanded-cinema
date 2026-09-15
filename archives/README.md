# archives

Closed experiments live here as workspace packages so they stay buildable,
typecheckable, and deployable without being the active work.

Rules:

- One directory per experiment, named `<slug>-<YYYY-MM>` for the month it
  closed. The package name inside does not change when it moves here.
- An archived experiment is read-only except for security fixes and the
  changes needed to keep the workspace green. New work happens in `apps/`.
- Each experiment's Brain retrospective lives in `.brain/archives/`; the
  experiment directory keeps its own `research/`, `critiques/`, and
  `STUDIES.md` where it had them.
- Shared code stays in `packages/`. If the next experiment needs something an
  archived one built, lift it into a package rather than importing across
  archives.

| experiment | closed | what it was |
| --- | --- | --- |
| `expanded-cinema-2026-09` | 2026-09-15 | Daily-then-continuous Three.js WebGPU studies on projection, delay, and colour with a local model as maker and a director session steering. Gallery still live on colour-01. |
