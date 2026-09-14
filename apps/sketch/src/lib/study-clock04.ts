import * as THREE from "three/webgpu";
import { CutDetector, ringLength } from "@expanded-cinema/core";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: clock-04 — beam. Branches clock-03; keeps the delay ring and the
 * material (Conquer by the Clock). Changes everything else per the AD's
 * scene contract (seq 20): a ROOM, not a black void — a projector at the
 * back-left throws the film as a beam of 200 additive luma-driven slices,
 * landing on a curved open-back cylinder screen at an angle; a second
 * dimmer beam replays the ring's DELAY-late past, offset one metre.
 * The apparatus is the subject: no flat rectangle facing a dead camera.
 */

const STUDY = "clock-04";
const DELAY = 180;
const RING = ringLength(DELAY); // 181, enforced by the core contract

/** Material this study projects (same cut; catalog sha from apps/sketch/catalog.json). */
export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

export interface ClockRuntime extends StudyRuntime {
  onPointer?(p: CurrentStudy): void;
  onResize(w: number, h: number): void;
  dispose(): void;
}

interface ClockScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pastCamera: THREE.PerspectiveCamera;
  screen: THREE.Mesh;
  proj1: THREE.Mesh;
  proj2: THREE.Mesh;
  canvases: THREE.Mesh[];
  slats: THREE.Mesh[];
  frame: { value: number };
  // intervention trace wall-clock
  traceAt: number | null;
  computeBandsFromVideo: (video: HTMLVideoElement) => { bands: Float32Array; luma: Float32Array; bandDetail: Float32Array } | null;
  bandAt: (framesAgo: number) => Float32Array | null;
  detailAt: (framesAgo: number) => Float32Array | null;
  lumaAt: (framesAgo: number) => Float32Array | null;
  pushBandHistory: (bands: Float32Array, detail: Float32Array, luma: Float32Array) => void;
}

/** Beam rig geometry (mirrors clock-02/03's scene scale for archive comparability). */
const LUMA_W = 64;
const LUMA_H = 36;
const SLICES = 120;
const SLICE_H = 2.2;
const BEAM_LEN = 3.1; // projector -> screen throw
const PROJ = new THREE.Vector3(-3.9, 1.35, 2.4);
const PROJ_OFF = new THREE.Vector3(PROJ.x + 1.0, PROJ.y - 0.15, PROJ.z);
const SCREEN_R = 3.4;
const SCREEN_ARC = Math.PI * 0.62; // yaw of the curved screen segment
const SCREEN_H = 3.3;
const SLICE_BAND = Math.floor((LUMA_W * LUMA_H) / SLICES); // luma cells per slice band
const FM_U = 6.4;
const FM_V = 3.6;

function buildScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050409, 0.06);

  // camera lives IN the room, low, slightly off-axis, and drifts on an arc
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.4, 0.85, 5.9);
  camera.lookAt(-0.5, 1.1, 0);

  // pastCamera: renders ONLY the luma quads into ring targets (kept from
  // clock-02/03 so same-view capture stays comparable across archives)
  const pastCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.set(0.4, 0.85, 5.9);
  pastCamera.lookAt(-0.5, 1.1, 0);

  // room: floor, back wall, curved screen — light receivers, not void
  const roomMat = new THREE.MeshLambertMaterial({ color: 0x1b1626 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), roomMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, -2);
  scene.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), roomMat);
  back.position.set(0, 3.5, -7.6);
  back.rotation.y = Math.PI; // face inward
  scene.add(back);

  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), roomMat);
  sideL.position.set(-10.3, 3.5, -2);
  sideL.rotation.y = Math.PI / 2;
  scene.add(sideL);

  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), roomMat);
  sideR.position.set(10.3, 3.5, -2);
  sideR.rotation.y = -Math.PI / 2;
  scene.add(sideR);

  scene.add(new THREE.AmbientLight(0x2a2440, 0.55));
  const spill1 = new THREE.PointLight(0x99aaff, 2.2, 16, 1.7);
  spill1.position.copy(PROJ);
  scene.add(spill1);
  const spill2 = new THREE.PointLight(0x88ccff, 1.2, 16, 1.8);
  spill2.position.set(PROJ.x + 1, PROJ.y - 0.2, PROJ.z);
  scene.add(spill2);

  // the curved screen: open cylinder segment; double-sided so its back edge
  // catches spill and the camera can see it has an outside
  const screenGeo = new THREE.CylinderGeometry(
    SCREEN_R, SCREEN_R, SCREEN_H, 48, 1, true, -SCREEN_ARC / 2, SCREEN_ARC,
  );
  // the film ON the curve: plain UVs initially (seq-21 fix 1); beam misses
  // dim it globally until per-vertex beam shading lands (v4 refinement)
  const screenMat = new THREE.MeshBasicMaterial({
    map: null, // videoTexture assigned at mount
    color: 0x0b0d12, // beam-dark until the beam luma drives it up
    side: THREE.DoubleSide,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, SCREEN_H / 2 - 0.1, -2.2);
  screen.rotation.y = Math.PI; // concave faces the camera/projector side
  scene.add(screen);

  // the projector bodies, visible apparatus
  const body = new THREE.CylinderGeometry(0.28, 0.34, 0.55, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.4, roughness: 0.3 });
  const proj1 = new THREE.Mesh(body, bodyMat);
  proj1.rotation.z = Math.PI / 2 - 0.45;
  proj1.position.copy(PROJ);
  scene.add(proj1);
  const proj2 = new THREE.Mesh(body, bodyMat);
  proj2.rotation.z = Math.PI / 2 - 0.45;
  proj2.position.set(PROJ.x + 1.0, PROJ.y - 0.15, PROJ.z);
  scene.add(proj2);

  // afterglow discs at the projector lens (breathing beat)
  const glow = ((): THREE.Mesh => {
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.5 }),
    );
    return g;
  })();
  void glow;
  const canvases: THREE.Mesh[] = [];
  const slats: THREE.Mesh[] = [];

  // beam-01 vertical slats: 16 per beam, each a thin bar across the beam's
  // full height at one arc fraction; samples a luma COLUMN (all rows at
  // that arc u) so vertical detail joins the horizontal band detail.
  const SLATS = 16;
  for (let si = 0; si < SLATS; si++) {
    const uFrac = (si + 0.5) / SLATS;
    for (const beam of [0, 1]) {
      const geo = new THREE.PlaneGeometry(SLICE_H * 0.5, BEAM_LEN);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        color: beam === 0 ? 0xdfe8ff : 0x9fd4ff,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { beam, slatIdx: si, uFrac };
      scene.add(mesh);
      slats.push(mesh);
    }
  }

  for (let i = 0; i < SLICES; i++) {
    const t0 = i / SLICES;
    const t1 = (i + 1) / SLICES;
    const y0 = (t0 - 0.5) * SLICE_H;
    const y1 = (t1 - 0.5) * SLICE_H;
    for (const beam of [0, 1]) {
      const geo = new THREE.PlaneGeometry(BEAM_LEN, Math.abs(y1 - y0));
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        color: (beam === 0 ? 0xdfe8ff : 0x9fd4ff),
      });
      const mesh = new THREE.Mesh(geo, mat);
      const org = beam === 0 ? PROJ : PROJ.clone().setX(PROJ.x + 1.0).setY(PROJ.y - 0.15);
      mesh.userData = { beam, idx: i, yMid: (y0 + y1) / 2 };
      mesh.position.set(0, 0, 0);
      mesh.visible = false;
      scene.add(mesh);
      canvases.push(mesh);
    }
  }

  const frame = { value: 0 };

  // ---------- CPU luma tap (seq-21 fix 2) ----------
  // The WebGPU readback path resolved but rendered black (diagnosed via
  // clock04.luma.stats). A 2D canvas tap is synchronous and honest: draw
  // the video frame at 32x18, read the pixels, feed CutDetector directly
  // AND per-slice band means for the beam modulation (no more mean-only
  // wash). Band history drives the DELAY-late past beam without ring reads.
  const lumaCanvas = document.createElement("canvas");
  lumaCanvas.width = LUMA_W;
  lumaCanvas.height = LUMA_H;
  const lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  // per-frame band means (SLICES bands, luma 0..1), ring of length RING
  const bandHistory: Float32Array[] = [];
  const detailHistory: Float32Array[] = [];
  const lumaHistory: Float32Array[] = []; // full 32x18 grids for the past beam
  const pushBandHistory = (bands: Float32Array, detail: Float32Array, luma: Float32Array): void => {
    bandHistory.push(bands);
    detailHistory.push(detail);
    lumaHistory.push(luma);
    if (bandHistory.length > RING) {
      bandHistory.shift();
      detailHistory.shift();
      lumaHistory.shift();
    }
  };
  const bandAt = (framesAgo: number): Float32Array | null => {
    const idx = bandHistory.length - 1 - framesAgo;
    return idx >= 0 ? (bandHistory[idx] ?? null) : null;
  };
  const detailAt = (framesAgo: number): Float32Array | null => {
    const idx = detailHistory.length - 1 - framesAgo;
    return idx >= 0 ? (detailHistory[idx] ?? null) : null;
  };
  const lumaAt = (framesAgo: number): Float32Array | null => {
    const idx = lumaHistory.length - 1 - framesAgo;
    return idx >= 0 ? (lumaHistory[idx] ?? null) : null;
  };

  const computeBandsFromVideo = (video: HTMLVideoElement): { bands: Float32Array; luma: Float32Array; bandDetail: Float32Array } | null => {
    if (video.readyState < 2) return null;
    lumaCtx.drawImage(video, 0, 0, LUMA_W, LUMA_H);
    const data = lumaCtx.getImageData(0, 0, LUMA_W, LUMA_H).data;
    const luma = new Float32Array(LUMA_W * LUMA_H);
    for (let i = 0; i < LUMA_W * LUMA_H; i++) {
      const o = i * 4;
      luma[i] = (0.299 * (data[o] ?? 0) + 0.587 * (data[o + 1] ?? 0) + 0.114 * (data[o + 2] ?? 0)) / 255;
    }
    // 120 bands over 18 rows: each band maps to a fractional row range.
    // v5: also capture 3 x-window means per band (left/mid/right thirds)
    // so slices carry horizontal picture detail, not just row luma.
    const bandDetail = new Float32Array(SLICES * 3);
    const bands = new Float32Array(SLICES);
    const rowsF = bandAt(0);
    void rowsF;
    for (let bi = 0; bi < SLICES; bi++) {
      // slice idx 0 = TOP of frame (y1 above y0 in buildScene ordering)
      const y01 = bi / SLICES; // 0 top .. 1 bottom
      const rowStart = Math.floor(y01 * LUMA_H);
      const rowEnd = Math.max(rowStart + 1, Math.floor(((bi + 1) / SLICES) * LUMA_H));
      let acc = 0;
      let count = 0;
      for (let ry = rowStart; ry < Math.min(rowEnd, LUMA_H); ry++) {
        for (let rx = 0; rx < LUMA_W; rx++) {
          acc += luma[ry * LUMA_W + rx] ?? 0;
          count++;
        }
      }
      bands[bi] = count > 0 ? acc / count : 0;
      // three x-thirds within the band rows
      for (let cx = 0; cx < 3; cx++) {
        let cacc = 0;
        let ccount = 0;
        for (let ry = rowStart; ry < Math.min(rowEnd, LUMA_H); ry++) {
          for (let rx = cx * Math.floor(LUMA_W / 3); rx < (cx + 1) * Math.floor(LUMA_W / 3); rx++) {
            cacc += luma[ry * LUMA_W + rx] ?? 0;
            ccount++;
          }
        }
        bandDetail[bi * 3 + cx] = ccount > 0 ? cacc / ccount : 0;
      }
    }
    return { bands, luma, bandDetail };
  };

  const cutDetector = new CutDetector();
  let lumaFramesSeen = 0;
  const traceAtHolder: { at: number | null } = { at: null };

  return {
    scene,
    camera,
    pastCamera,
    screen,
    proj1,
    proj2,
    canvases,
    slats,
    frame,
    traceAt: traceAtHolder.at,
    computeBandsFromVideo,
    bandAt,
    detailAt,
    lumaAt,
    pushBandHistory,
  };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<ClockRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene();
    // seq-24: the mount-time seek raced the video layer AND 120s exceeds
    // this clip's 90s duration (clamped -> looped back to the cards).
    // 55s is inside the film, past both front cards. Re-assert until the
    // time holds (element swaps reset playback to 0).
    const SEEK_TO = 63; // brighter in-point (55s reads too dark on the wall, seq-27)
    let seekAttempts = 0;
    const revealHolder = { revealed: false };
    const vidOf = (): HTMLVideoElement | null =>
      (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image ?? null;
    // v13 (seq-27): DETERMINISTIC first paint. The v8 reveal raced a stale
    // 'seeked' from the OLD element (already at SEEK_TO from a prior pass)
    // firing while the fresh element sat at 0 — the card then showed full.
    // Now: screen map = NULL at mount; the map is assigned only when the
    // seeked event arrives from the CURRENT element AT SEEK_TO.
    const screenMat = study.screen.material as THREE.MeshBasicMaterial;
    const unwrapRepeat = (tex: THREE.Texture): void => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1; // cylinder inner face reads mirrored otherwise (seq-23)
    };
    unwrapRepeat(videoLayer.texture);
    screenMat.map = null; // nothing chosen yet -> nothing shown
    const onSeeked = (ev: Event): void => {
      if (revealHolder.revealed) return; // v21: one-shot guard
      const vid = ev.target as HTMLVideoElement;
      if (vid !== vidOf()) return; // stale element's event: ignore
      if (Math.abs(vid.currentTime - SEEK_TO) >= 1.5) return; // wrong place
      screenMat.map = videoLayer.texture; // the chosen frame, only now
      screenMat.needsUpdate = true;
      revealHolder.revealed = true;
      void sketchEvents
        .emitInfo("study", "clock04.screen.reveal", { at: Number(vid.currentTime.toFixed(2)), via: "seeked" })
        .catch(() => undefined);
    };
    videoLayer.texture.addEventListener?.("dispose", () => {
      if (screenMat.map === videoLayer.texture) screenMat.map = null;
    });
    vidOf()?.addEventListener("seeked", onSeeked);
    // backstop reveal check (seq-29): runs every frame; fires if seeked
    // never does — readyState>=2 AND currentTime within 0.5s of SEEK_TO
    let firstStepAt: number | null = null;
    let revealProofLogs = 0;
    let bubbleLogs = 0;
    const revealProofTick = (elapsed: number): void => {
      if (revealHolder.revealed) return;
      if (revealProofLogs >= 30 || elapsed - revealProofLogs * 1000 < 1000) return;
      revealProofLogs++;
      const vid = vidOf();
      void sketchEvents
        .emitInfo("study", "clock04.reveal.proof", {
          elapsed: Number(elapsed.toFixed(0)),
          readyState: vid?.readyState ?? -1,
          t: Number((vid?.currentTime ?? -1).toFixed(2)),
          want: SEEK_TO,
        })
        .catch(() => undefined);
    };
    const revealBackstop = (): void => {
      if (revealHolder.revealed) return;
      const vid = vidOf();
      if (!vid) return;
      if (vid.readyState >= 2 && Math.abs(vid.currentTime - SEEK_TO) <= 0.5) {
        revealHolder.revealed = true;
        screenMat.map = videoLayer.texture;
        screenMat.needsUpdate = true;
        void sketchEvents
          .emitInfo("study", "clock04.screen.reveal", { at: Number(vid.currentTime.toFixed(2)), via: "backstop" })
          .catch(() => undefined);
      }
    };
    const seekTick = (): void => {
      if (revealHolder.revealed) return; // one-shot: never re-seek after reveal
      const vid = vidOf();
      if (!vid) return;
      if (Math.abs(vid.currentTime - SEEK_TO) <= 1.5) return; // already there
      vid.currentTime = SEEK_TO;
      seekAttempts++;
      if (Math.abs(vid.currentTime - SEEK_TO) > 1.5 && seekAttempts < 20) setTimeout(seekTick, 1000);
    };
    seekTick();
    document.addEventListener("seeked", onSeeked, true); // capture phase: element swaps included
    const detector = new CutDetector();
    let lumaFramesSeen = 0;
    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      onPointer(p) {
        // pointer cut = an intervention the room feels: projector pulse
        study.traceAt = performance.now();
        void sketchEvents
          .emitInfo("study", "clock04.intervention", { sha: p.sha.slice(0, 16), source: "pointer" })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        void delta; // signature parity with StudyRuntime
        // seq-30: key the rail (and everything else time-based) to
        // ELAPSED SINCE FIRST STEP, not the shared animation clock —
        // two loads of the same sha must open on the same authored frame
        if (firstStepAt === null) firstStepAt = now;
        const elapsed = now - (firstStepAt ?? now);
        revealBackstop();
        revealProofTick(elapsed);
        const n = study.frame.value;
        // v21 (AD seq-32): the re-assert loop pinned the video at 63
        // forever — seekTick fired every second even after reveal, so the
        // "picture" was one frame. Seek re-assert is now DEAD once the
        // reveal fires: the film plays free from there.
        if (!revealHolder.revealed && n % 60 === 0 && seekAttempts < 6) seekTick();

        // CPU luma tap (honest, synchronous): bands for beams + CutDetector
        const video = (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image;
        const tap = video ? study.computeBandsFromVideo(video) : null;
        if (tap) {
          study.pushBandHistory(tap.bands, tap.bandDetail, tap.luma);
          const frame = { pixels: Array.from(tap.luma), width: LUMA_W, height: LUMA_H };
          lumaFramesSeen++;
          if (lumaFramesSeen % 600 === 1) {
            let sum = 0;
            for (const v of tap.luma) sum += v;
            void sketchEvents
              .emitInfo("study", "clock04.luma.stats", {
                seen: lumaFramesSeen,
                meanLuma: Number((sum / tap.luma.length).toFixed(2)),
              })
              .catch(() => undefined);
          }
          if (detector.push(frame)) {
            study.traceAt = performance.now();
            void sketchEvents
              .emitInfo("study", "clock04.cut", { at: Number(study.traceAt.toFixed(0)), source: "film" })
              .catch(() => undefined);
          }
        }

        // v20 (AD seq-31): open LOW and NEAR the screen — the film is the
        // largest thing in the opening frame — hold ~7s, then arc back into
        // the room. The old default (0.4,0.85,5.9) sat INSIDE the near
        // beam's volume and read as a white slab for 20s.
        const RAIL: Array<{ t: number; p: [number, number, number]; l: [number, number, number] }> = [
          { t: 0.0, p: [0.55, 0.75, 3.2], l: [-0.2, 1.25, -2.2] }, // low, near screen, film fills frame
          { t: 0.15, p: [0.7, 0.85, 3.6], l: [-0.4, 1.2, -2.2] }, // ~7s hold with a slow drift
          { t: 0.35, p: [1.4, 1.15, 5.6], l: [-0.6, 1.15, -1.8] }, // pull back into the room
          { t: 0.55, p: [2.0, 1.5, 6.4], l: [-1.0, 1.1, -2.0] }, // right of default
          { t: 0.75, p: [0.9, 1.1, 6.4], l: [-0.7, 1.2, -1.9] }, // back left
          { t: 1.0, p: [0.55, 0.75, 3.2], l: [-0.2, 1.25, -2.2] }, // loop close
        ];
        const railAt = (f: number): { p: THREE.Vector3; l: THREE.Vector3 } => {
          let i = 0;
          for (let k = 0; k < RAIL.length - 1; k++) {
            if (f >= (RAIL[k]?.t ?? 0) && f <= (RAIL[k + 1]?.t ?? 0)) {
              i = k;
              break;
            }
          }
          const a = RAIL[i] ?? RAIL[0]!;
          const b = RAIL[i + 1] ?? RAIL[RAIL.length - 1]!;
          const span = (b.t - a.t) + 1e-9;
          const u = Math.min(1, Math.max(0, (f - a.t) / span));
          const ease = u * u * (3 - 2 * u); // smoothstep
          return {
            p: new THREE.Vector3(
              a.p[0] + (b.p[0] - a.p[0]) * ease,
              a.p[1] + (b.p[1] - a.p[1]) * ease,
              a.p[2] + (b.p[2] - a.p[2]) * ease,
            ),
            l: new THREE.Vector3(
              a.l[0] + (b.l[0] - a.l[0]) * ease,
              a.l[1] + (b.l[1] - a.l[1]) * ease,
              a.l[2] + (b.l[2] - a.l[2]) * ease,
            ),
          };
        };
        const rail = railAt((elapsed % 48_000) / 48_000);
        study.camera.position.copy(rail.p);
        study.camera.lookAt(rail.l);
        // transient flash: the intervention trace the room feels
        const since = now - (study.traceAt ?? -1e9);
        const cutGlow = since >= 0 && since < 900 ? Math.max(0, 1 - since / 900) : 0;

        // v12: camera-beam proximity falloff — the camera's distance from
        // each projector drives a fade on that beam; at close range the
        // wash back off so room + picture stay readable (v11 15s frame)
        // v20 (AD seq-31): bubble fade by CAMERA-TO-BEAM-SEGMENT distance —
        // the old distance-to-projector fade missed the real failure (the
        // camera INSIDE the beam cone between origin and landing). Inside
        // ~1m of the beam line: alpha to ~0.15; full alpha by ~3m.
        const B0_END = new THREE.Vector3(0.0, 1.6, 1.2); // beam 0 lands on the screen
        const B1_END = new THREE.Vector3(2.2, 1.0, -7.55); // beam 1 lands on the back wall
        const segDist = (a: THREE.Vector3, b: THREE.Vector3): number => {
          const ab = b.clone().sub(a);
          const t = Math.max(0, Math.min(1, study.camera.position.clone().sub(a).dot(ab) / ab.lengthSq()));
          return study.camera.position.distanceTo(a.clone().addScaledVector(ab, t));
        };
        const bubble = (d: number): number => {
          const u = Math.min(1, Math.max(0, (d - 1.0) / 2.0)); // 1m → 3m ramp
          return 0.15 + 0.85 * (u * u * (3 - 2 * u));
        };
        const fade1 = bubble(segDist(PROJ, B0_END));
        const fade2 = bubble(segDist(PROJ_OFF, B1_END));
        // v21 (AD seq-32): bubble-proof — computed alphas, once a second,
        // first 10s, so a non-biting fade is VISIBLE in the console
        if (bubbleLogs < 10) {
          const elS = elapsed / 1000;
          if (Math.floor(elS) > bubbleLogs) {
            bubbleLogs = Math.floor(elS);
            void sketchEvents
              .emitInfo("study", "clock04.bubble.alpha", {
                s: bubbleLogs,
                cam: [
                  Number(study.camera.position.x.toFixed(2)),
                  Number(study.camera.position.y.toFixed(2)),
                  Number(study.camera.position.z.toFixed(2)),
                ],
                d0: Number(segDist(PROJ, B0_END).toFixed(2)),
                d1: Number(segDist(PROJ_OFF, B1_END).toFixed(2)),
                fade1: Number(fade1.toFixed(3)),
                fade2: Number(fade2.toFixed(3)),
              })
              .catch(() => undefined);
          }
        }

        // per-slice beams: brightness = the FRAME at that slice's row band
        // (live bands for beam 0; DELAY-late history for beam 1)
        const live = revealHolder.revealed && tap ? tap.bands : null;
        const past = revealHolder.revealed && tap ? study.bandAt(DELAY) : null;
        const pastLuma = revealHolder.revealed && tap ? study.lumaAt(DELAY) : null;
        for (const m of study.canvases) {
          const { beam, idx, yMid } = m.userData as { beam: number; idx: number; yMid: number };
          const org = beam === 0 ? PROJ : PROJ_OFF;
          const u = -0.02 + yMid * 0.16;
          const sx = SCREEN_R * Math.sin(u);
          const sz = SCREEN_R * Math.cos(u) - 2.2;
          // beam 1 (the delayed past) misses the screen and lands on the
          // BACK WALL, spread wide; v5: the landing point drifts with the
          // delayed bands so the past visibly moves on the wall (critique)
          const pastBand = past?.[idx] ?? 0;
          const drift = (pastBand - 0.35) * 2.6;
          const tx = beam === 0 ? sx : 2.2 + yMid * 2.1 + drift;
          const ty = beam === 0 ? 1.1 + yMid : 1.0 + yMid * 1.35 + drift * 0.4;
          const tz = beam === 0 ? sz : -7.55;
          const dir = new THREE.Vector3(tx - org.x, ty - org.y, tz - org.z);
          const len = dir.length();
          m.position.copy(org).addScaledVector(dir, 0.5);
          m.scale.set(len, 1, 1);
          m.visible = true;
          const yaw = Math.atan2(dir.z, dir.x);
          const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
          m.rotation.set(0, -yaw, pitch);
          m.rotateY(Math.PI / 2);
          // v7: the cone IS the picture's footprint. UV-space of this
          // slice's landing point on the screen: u spans [-0.02, +0.14],
          // map to a col window of the luma tap (LUMA_W wide); the row is
          // this slice's band. That sampled patch's MEAN drives the slice —
          // dark picture regions read as dark gaps IN the beam cone.
          const bands = beam === 0 ? live : past;
          const lumaTap = beam === 0 ? (tap?.luma ?? null) : pastLuma;
          const bandL = bands?.[idx] ?? 0;
          const uMid = yMid * 0.16 - 0.02 + 0.06; // landing u, mid of quad span
          // past beam samples the PAST luma grid across its wall span
          // (wall x 2.2..4.3 -> left..right col, mirroring the live arc)
          const colF = Math.max(
            0,
            Math.min(
              LUMA_W - 1,
              (beam === 0
                ? uMid / 0.14
                : (tx - 2.2) / 2.1) * LUMA_W,
            ),
          );
          const col0 = Math.max(0, Math.floor(colF - 2));
          const rowF = Math.max(0, Math.min(LUMA_H - 1, (idx / SLICES) * LUMA_H));
          const patchRow = Math.floor(rowF);
          let patchAcc = 0;
          let patchN = 0;
          if (lumaTap) {
            for (let dx = 0; dx < 7 && col0 + dx < LUMA_W; dx++) {
              patchAcc += lumaTap[patchRow * LUMA_W + col0 + dx] ?? 0;
              patchN++;
            }
          }
          const patchL = patchN > 0 ? patchAcc / patchN : bandL;
          // footprint weighted by its band mean so the cone keeps a body
          const bright = Math.min(1, patchL * 1.35 + bandL * 0.5 + cutGlow * 0.35);
          const fade = beam === 0 ? fade1 : fade2;
          const mm = m.material as THREE.MeshBasicMaterial;
          mm.opacity = (beam === 0 ? 0.03 + bright * 0.26 : 0.02 + bright * 0.2) * fade;
        }

        // beam-01 vertical slats (now live, was dead since v13 rewrites):
        // each slat is a thin bar across the beam's height at one arc
        // fraction; brightness = the luma tap's COLUMN at that fraction
        // (rows summed), so vertical picture structure joins band detail.
        const SLATS = 16;
        for (const sm2 of study.slats) {
          const { beam: bBeam, slatIdx: bSi, uFrac: bU } = sm2.userData as { beam: number; slatIdx: number; uFrac: number };
          const org = bBeam === 0 ? PROJ : PROJ_OFF;
          if (!(revealHolder.revealed && tap)) {
            sm2.visible = false;
            continue;
          }
          sm2.visible = true;
          const bU2 = -0.02 + bU * 0.16;
          const bsx = SCREEN_R * Math.sin(bU2);
          const bsz = SCREEN_R * Math.cos(bU2) - 2.2;
          const bdir = new THREE.Vector3(bsx - org.x, 1.1 - org.y, bsz - org.z);
          const blen = bdir.length();
          // v21b: 16 slats were ALL copied to the beam midpoint — a
          // 16-deep coplanar additive stack = the white slab. Distribute
          // them ALONG the beam instead (each owns 1/16 of the throw).
          sm2.position.copy(org).addScaledVector(bdir, (bSi + 0.5) / SLATS);
          sm2.scale.set(1, blen, 1);
          sm2.rotation.set(0, -Math.atan2(bdir.z, bdir.x), Math.atan2(bdir.y, Math.hypot(bdir.x, bdir.z)));
          sm2.rotateZ(Math.PI / 2);
          const cF = Math.max(0, Math.min(LUMA_W - 1, bU * 0.14 * LUMA_W));
          const bcol = Math.max(0, Math.floor(cF - 1));
          const bgrid = bBeam === 0 ? tap.luma : pastLuma;
          let bcacc = 0;
          let bcn = 0;
          if (bgrid) {
            for (let ry = 0; ry < LUMA_H; ry++) {
              bcacc += bgrid[ry * LUMA_W + bcol] ?? 0;
              bcn++;
            }
          }
          const bcolL = bcn > 0 ? bcacc / bcn : 0;
          const bbright = Math.min(1, bcolL * 1.35 + cutGlow * 0.3);
          const bfade = bBeam === 0 ? fade1 : fade2;
          const bmm = sm2.material as THREE.MeshBasicMaterial;
          bmm.opacity = (bBeam === 0 ? 0.02 + bbright * 0.28 : 0.015 + bbright * 0.13) * bfade;
        }
        void SLATS;

        // lens breathing: projectors inhale on their own cadence; cut flash
        const pulse = Math.sin((now / 2400) % (Math.PI * 2)) * 0.5 + 0.5;
        const p1 = study.proj1.material as THREE.MeshStandardMaterial;
        const p2 = study.proj2.material as THREE.MeshStandardMaterial;
        p1.emissiveIntensity = 0.25 + pulse * 0.45 + cutGlow * 0.8;
        p2.emissiveIntensity = 0.25 + (1 - pulse) * 0.35 + cutGlow * 0.5;
        // screen brightens with the cut flash (beam carries the jolt)
        const sm = study.screen.material as THREE.MeshBasicMaterial;
        sm.color.setScalar(0.06 + cutGlow * 0.55);

        r.render(study.scene, study.camera);
        study.frame.value = n + 1;
      },
      onResize(w, h) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
        study.pastCamera.aspect = w / h;
        study.pastCamera.updateProjectionMatrix();
      },
      dispose() {
        for (const m of study.slats) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
        for (const m of study.canvases) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
        study.screen.geometry.dispose();
        (study.screen.material as THREE.Material).dispose();
        study.proj1.geometry.dispose();
        (study.proj1.material as THREE.Material).dispose();
        study.proj2.geometry.dispose();
        (study.proj2.material as THREE.Material).dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
