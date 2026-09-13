# videos/

Source clips for the loop. The ingest pipeline drops clips here and runs
`pnpm catalog:videos` to regenerate `apps/sketch/catalog.json`.

Classification contract (filename suffixes):

- `*.mp4` — direct-play (both HTMLVideoElement and grouped WebGPU reader)
- `*.readback.mp4` — also direct-play, marked as gpu-readback study input
- `*.orchestration.mp4` — orchestration-only, suppressed from the loop

Today: empty until the pipeline produces the first real clip. The starter
placeholder lives at `apps/sketch/public/videos/starter.mp4`.
