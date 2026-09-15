/**
 * Study: clock-05 — a clock you do not own.
 *
 * Branches clock-02's same-view memory grammar onto a second material: the
 * NWS CONUS radar mosaic (research/2026-09-14-clock-05.md; snapshot
 * media/radar-clock05/, provenance + burned-in frame stamps recorded).
 *
 * The material is ALREADY late: each radar frame is minutes behind the world
 * it shows (composite + publish latency), and the 10-frame loop spans 20
 * world-minutes. The study's delay adds a second lateness on top: the memory
 * panel shows the SAME feed DELAY_FRAMES older. The world's delay + the
 * ring's delay sit side by side.
 *
 * No video element: the study runs on ten snapshot textures, so it is
 * replay-verifiable headless (same evidence path as phone-01's trace).
 */

import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

const STUDY = "clock-05";

/** Memory panel lags the main surface by 4 world-minutes' worth of frames. */
const DELAY_FRAMES = 4;

/** Main surface advances one radar frame every 10s (a 10-frame loop = 100s). */
const FRAME_S = 10;

/** Measured at fetch 2026-09-15T03:34:38Z (media/radar-clock05/provenance.md):
 *  newest frame (03:28Z) was 6.6 min behind the world; oldest (03:10Z) 24.6.
 *  The feed's own lateness the ring rides on top of. */
const FEED_LATENESS_MIN = { newest: 6.6, oldest: 24.6 };

/** Frame datetime stamps (UTC) burned into each mosaic. */
const STAMPS = [
  "03:10", "03:12", "03:14", "03:16", "03:18",
  "03:20", "03:22", "03:24", "03:26", "03:28",
];

/** No video material: videoDecl null keeps the archive element untouched. */
export const VIDEO: { src: string; hash: string } | null = null;

export interface Clock05Runtime extends StudyRuntime {
  onPointer?(p: CurrentStudy): void;
}

interface Clock05Scene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  main: THREE.Mesh;
  memory: THREE.Mesh;
  stamp: THREE.Mesh;
  stampCanvas: HTMLCanvasElement;
  stampTexture: THREE.CanvasTexture;
  frames: THREE.Texture[];
  frame: { value: number };
  lastAdvance: { at: number };
}

interface RadarTextureSet {
  frames: THREE.Texture[];
}

let radarCache: RadarTextureSet | null = null;

async function loadRadarFrames(): Promise<RadarTextureSet> {
  if (radarCache) return radarCache;
  const loader = new THREE.TextureLoader();
  const frames: THREE.Texture[] = [];
  for (let i = 1; i <= 10; i++) {
    const n = String(i).padStart(2, "0");
    const tex = await loader.loadAsync(`/radar/clock05/rad${n}.jpg`);
    tex.colorSpace = THREE.SRGBColorSpace;
    frames.push(tex);
  }
  radarCache = { frames };
  return radarCache;
}

function drawStamp(
  canvas: HTMLCanvasElement,
  stamp: string,
  latenessMin: number,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = "#05060a";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#cfe0ff";
  ctx.font = "28px monospace";
  ctx.textBaseline = "middle";
  ctx.fillText(`frame ${stamp} UTC`, 14, h * 0.38);
  ctx.fillStyle = "#7fa8d0";
  ctx.font = "22px monospace";
  ctx.fillText(`late ${latenessMin.toFixed(1)} min at fetch`, 14, h * 0.72);
}

function buildScene(tex: RadarTextureSet): Clock05Scene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x04050a);
  scene.add(new THREE.AmbientLight(0x404a5a, 0.9));

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 6.4);
  camera.lookAt(0, 1.0, 0);

  // The world's picture, now (already late by the feed's own latency):
  const main = new THREE.Mesh(
    new THREE.PlaneGeometry(6.0, 2.82), // 1280x602 aspect preserved
    new THREE.MeshBasicMaterial({ map: tex.frames[9] ?? null }),
  );
  main.position.set(0, 1.05, -2.0);
  scene.add(main);

  // The same feed, DELAY_FRAMES older: the ring's lateness made visible.
  const memory = new THREE.Mesh(
    new THREE.PlaneGeometry(3.0, 1.41),
    new THREE.MeshBasicMaterial({ color: 0x090a12 }),
  );
  memory.position.set(-4.6, 0.85, 0.4);
  memory.rotation.y = 0.18;
  scene.add(memory);

  // The clock you do not own: the feed's own timestamp + measured lateness.
  const stampCanvas = document.createElement("canvas");
  stampCanvas.width = 460;
  stampCanvas.height = 96;
  const stampTexture = new THREE.CanvasTexture(stampCanvas);
  stampTexture.colorSpace = THREE.SRGBColorSpace;
  const stamp = new THREE.Mesh(
    new THREE.PlaneGeometry(3.1, 0.65),
    new THREE.MeshBasicMaterial({ map: stampTexture, transparent: true }),
  );
  stamp.position.set(4.35, 0.9, 0.2);
  stamp.rotation.y = -0.18;
  scene.add(stamp);

  return {
    scene, camera, main, memory, stamp,
    stampCanvas, stampTexture,
    frames: tex.frames,
    frame: { value: 9 },
    lastAdvance: { at: 0 },
  };
}

function stampFor(k: number): string {
  return STAMPS[((k % 10) + 10) % 10] ?? "03:28";
}

function latenessFor(k: number): number {
  // linear between oldest-first ordering: index 0 = oldest = FEED_OLDEST
  const i = ((k % 10) + 10) % 10; // 0..9, older frames lower index? frame_01 = 03:10 = oldest
  return FEED_LATENESS_MIN.oldest - (FEED_LATENESS_MIN.oldest - FEED_LATENESS_MIN.newest) * (i / 9);
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  _videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<Clock05Runtime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const tex = await loadRadarFrames();
    const study = buildScene(tex);

    drawStamp(study.stampCanvas, stampFor(9), latenessFor(9));
    study.stampTexture.needsUpdate = true;

    const memoryMat = study.memory.material as THREE.MeshBasicMaterial;
    memoryMat.map = tex.frames[(9 - DELAY_FRAMES + 10) % 10] ?? null;
    memoryMat.color.set(0xffffff);

    void sketchEvents
      .emitInfo("study", "study.ready", { study: STUDY, delayFrames: DELAY_FRAMES })
      .catch(() => undefined);
    // the receipt: the feed's lateness is MEASURED, not assumed
    void sketchEvents
      .emitInfo("study", "clock05.lag", {
        measuredMinNewest: FEED_LATENESS_MIN.newest,
        measuredMinOldest: FEED_LATENESS_MIN.oldest,
        ringLagMinutes: DELAY_FRAMES * 2,
        basis: "burned-in frame stamps vs fetch wallclock",
      })
      .catch(() => undefined);

    let lastPointerKey = "";

    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY_FRAMES,
      onPointer(p) {
        const key = `${p.study}@${p.sha}@${p.updatedAt}`;
        if (key === lastPointerKey) return;
        lastPointerKey = key;
        void sketchEvents
          .emitInfo("study", "clock05.pointerCut", { sha: p.sha.slice(0, 16) })
          .catch(() => undefined);
      },
      step(r, now) {
        // advance main surface on the slowed world cadence; memory follows
        if (now - study.lastAdvance.at >= FRAME_S * 1000) {
          study.lastAdvance.at = now;
          study.frame.value = (study.frame.value + 1) % 10;
          const k = study.frame.value;
          (study.main.material as THREE.MeshBasicMaterial).map =
            study.frames[k] ?? null;
          const mm = study.memory.material as THREE.MeshBasicMaterial;
          mm.map = study.frames[(k - DELAY_FRAMES + 10) % 10] ?? null;
          drawStamp(study.stampCanvas, stampFor(k), latenessFor(k));
          study.stampTexture.needsUpdate = true;
          void sketchEvents
            .emitInfo("study", "clock05.frame", { k, stamp: stampFor(k) })
            .catch(() => undefined);
        }
        r.render(study.scene, study.camera);
      },
      onResize(w: number, h: number) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
      },
      dispose() {
        for (const f of study.frames) f.dispose();
        study.main.geometry.dispose();
        (study.main.material as THREE.Material).dispose();
        study.memory.geometry.dispose();
        (study.memory.material as THREE.Material).dispose();
        study.stamp.geometry.dispose();
        (study.stamp.material as THREE.Material).dispose();
        study.stampTexture.dispose();
      },
    };
  });
}

export { DELAY_FRAMES, FRAME_S, STUDY, STAMPS };
