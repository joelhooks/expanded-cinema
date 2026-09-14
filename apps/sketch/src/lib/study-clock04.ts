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
  frame: { value: number };
  // intervention trace wall-clock
  traceAt: number | null;
  computeBandsFromVideo: (video: HTMLVideoElement) => { bands: Float32Array; luma: Float32Array } | null;
  bandAt: (framesAgo: number) => Float32Array | null;
  pushBandHistory: (bands: Float32Array) => void;
}

/** Beam rig geometry (mirrors clock-02/03's scene scale for archive comparability). */
const LUMA_W = 32;
const LUMA_H = 18;
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
  const pushBandHistory = (bands: Float32Array): void => {
    bandHistory.push(bands);
    if (bandHistory.length > RING) bandHistory.shift();
  };
  const bandAt = (framesAgo: number): Float32Array | null => {
    const idx = bandHistory.length - 1 - framesAgo;
    return idx >= 0 ? (bandHistory[idx] ?? null) : null;
  };

  const computeBandsFromVideo = (video: HTMLVideoElement): { bands: Float32Array; luma: Float32Array } | null => {
    if (video.readyState < 2) return null;
    lumaCtx.drawImage(video, 0, 0, LUMA_W, LUMA_H);
    const data = lumaCtx.getImageData(0, 0, LUMA_W, LUMA_H).data;
    const luma = new Float32Array(LUMA_W * LUMA_H);
    for (let i = 0; i < LUMA_W * LUMA_H; i++) {
      const o = i * 4;
      luma[i] = (0.299 * (data[o] ?? 0) + 0.587 * (data[o + 1] ?? 0) + 0.114 * (data[o + 2] ?? 0)) / 255;
    }
    // 120 bands over 18 rows: each band maps to a fractional row range
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
    }
    return { bands, luma };
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
    frame,
    traceAt: traceAtHolder.at,
    computeBandsFromVideo,
    bandAt,
    pushBandHistory,
  };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<ClockRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene();
    const vid = (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image;
    if (vid) {
      // seq-23: open on moving footage, not the RKO card
      vid.currentTime = 40;
    }
    const screenMap = videoLayer.texture;
    screenMap.wrapS = THREE.RepeatWrapping;
    screenMap.repeat.x = -1; // cylinder inner face reads mirrored otherwise (seq-23)
    (study.screen.material as THREE.MeshBasicMaterial).map = screenMap;
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
        const n = study.frame.value;

        // CPU luma tap (honest, synchronous): bands for beams + CutDetector
        const video = (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image;
        const tap = video ? study.computeBandsFromVideo(video) : null;
        if (tap) {
          study.pushBandHistory(tap.bands);
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

        // camera: eye height, both projectors behind the shoulder; a WIDE
        // arc (~±20 deg over 30s => ~7 deg per 10s frame pair, per seq-23)
        // plus a slow dolly 6.6 -> 7.4 over ~45s so the gap is unmissable
        const phase = (now % 30_000) / 30_000;
        const ang = (phase * Math.PI) / 4.5 - Math.PI / 9; // ±20 deg
        const dolly = 7.0 + Math.sin(((now % 45_000) / 45_000) * Math.PI * 2) * 0.4;
        study.camera.position.set(
          1.35 + Math.sin(ang) * 1.15,
          1.05 + Math.sin((now / 5200) % (Math.PI * 2)) * 0.12,
          dolly + Math.cos(ang) * 0.5,
        );
        study.camera.lookAt(-0.75, 1.05, -2.2);

        // transient flash: the intervention trace the room feels
        const since = now - (study.traceAt ?? -1e9);
        const cutGlow = since >= 0 && since < 900 ? Math.max(0, 1 - since / 900) : 0;

        // per-slice beams: brightness = the FRAME at that slice's row band
        // (live bands for beam 0; DELAY-late history for beam 1)
        const live = tap ? tap.bands : null;
        const past = tap ? study.bandAt(DELAY) : null;
        for (const m of study.canvases) {
          const { beam, idx, yMid } = m.userData as { beam: number; idx: number; yMid: number };
          const org = beam === 0 ? PROJ : PROJ_OFF;
          const u = -0.02 + yMid * 0.16;
          const sx = SCREEN_R * Math.sin(u);
          const sz = SCREEN_R * Math.cos(u) - 2.2;
          // beam 1 (the delayed past) misses the screen and lands on the
          // BACK WALL, spread wide so its half of the room is lit (seq-23)
          const tx = beam === 0 ? sx : 2.2 + yMid * 2.1;
          const ty = beam === 0 ? 1.1 + yMid : 1.0 + yMid * 1.35;
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
          const bands = beam === 0 ? live : past;
          const bright = Math.min(1, ((bands?.[idx] ?? 0) * 2.1 + cutGlow * 0.35));
          const mm = m.material as THREE.MeshBasicMaterial;
          mm.opacity = beam === 0 ? 0.05 + bright * 0.42 : 0.02 + bright * 0.16;
        }

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
