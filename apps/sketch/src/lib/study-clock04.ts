import * as THREE from "three/webgpu";
import {
  CutDetector,
  Sequencer,
  ringLength,
  readSlot,
  traceState,
  writeSlot,
  type LumaFrame,
} from "@expanded-cinema/core";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: clock-04 — surface as sculpture. Branches clock-03 per its
 * critique's open question (unresolved verdict + 2026-09-14 watch notes).
 * Question: what if the past is not painted ON the footage but torn out
 * of it — the memory band leaves the footage plane as a rigid shard,
 * seeded at the FILM'S OWN hard cuts, and a pointer cut displaces it for
 * a bounded window (durable intervention trace, per the dream's
 * three-layer one-frame legibility claim).
 * Subtraction (the critique's ask): the pointer raster panel and the
 * waterfall wipe band are GONE. Source footage + memory panel + shard only.
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
  footage: THREE.Mesh;
  memory: THREE.Mesh;
  pastShard: THREE.Mesh;
  videoTexture: THREE.VideoTexture;
  targets: THREE.RenderTarget[];
  frame: { value: number };
  // intervention trace wall-clock
  traceAt: number | null;
  // cut detection
  lumaSeq: Sequencer<Uint8Array>;
  lumaTarget: THREE.RenderTarget;
  lastPointerKey: string;
  lastReadErrorAt: number;
}

/** Geometry constants mirroring clock-02/03 so archives stay comparable. */
const GEO_W = 5.6;
const GEO_H = 3.15;
const MEM_W = 2.8;
const MEM_H = 1.575;
const SHARD_W = 1.2;
const SHARD_H = 3.15;
const SHARD_REST_X = -3.4; // torn-out resting position, beside the footage
const SHARD_DEPTH = 0.55; // out of the footage plane (z toward viewer)
const LUMA_W = 32;
const LUMA_H = 18;

function buildScene(videoTexture: THREE.VideoTexture): ClockScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 0.6, 8.2);
  camera.lookAt(0, 0.6, 0);
  const pastCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.copy(camera.position);
  pastCamera.rotation.copy(camera.rotation);
  pastCamera.lookAt(0, 0.6, -2);

  const footage = new THREE.Mesh(
    new THREE.PlaneGeometry(GEO_W, GEO_H),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  footage.position.set(0, 1.0, -2.0);
  scene.add(footage);

  // the shard: torn from the footage plane; a rigid vertical slice of the
  // PAST. Starts at the footage plane, displaced by cut/pointer events,
  // decays back per the intervention-trace contract (durable, then eased).
  const pastShard = new THREE.Mesh(
    new THREE.PlaneGeometry(SHARD_W, SHARD_H),
    new THREE.MeshBasicMaterial({ color: 0x08080f, transparent: true, opacity: 0 }),
  );
  pastShard.position.set(0, 1.0, -1.9);
  pastShard.visible = false;
  scene.add(pastShard);

  // memory panel: SAME view DELAY frames late (verified grammar, unchanged)
  const memory = new THREE.Mesh(
    new THREE.PlaneGeometry(MEM_W, MEM_H),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  memory.position.set(-4.35, 0.9, 0.6);
  scene.add(memory);

  // NOTE (subtraction): no pointer raster plane, no wipe band. The pointer
  // cut lives only in the shard displacement and the o11y ring.

  const targetSize = 640;
  const targetHeight = Math.round((targetSize * window.innerHeight) / window.innerWidth);
  const targets = Array.from(
    { length: RING },
    () => new THREE.RenderTarget(targetSize, targetHeight, { depthBuffer: false }),
  );
  const frame = { value: 0 };

  const lumaTarget = new THREE.RenderTarget(LUMA_W, LUMA_H, { depthBuffer: false });
  const lumaBuf = new Uint8Array(LUMA_W * LUMA_H * 4);

  // detection lives in a closure so the sequencer can drive it in-order;
  // traceAt is a mutable holder shared with the scene object
  const cutDetector = new CutDetector();
  const traceAtHolder: { at: number | null } = { at: null };
  const lumaSeq = new Sequencer<Uint8Array>((buf: Uint8Array) => {
    const cut = cutDetector.push(lumaFrameOf(buf));
    if (!cut) return;
    traceAtHolder.at = performance.now();
    void sketchEvents
      .emitInfo("study", "clock04.shard", { at: Number(traceAtHolder.at.toFixed(0)), source: "cut" })
      .catch(() => undefined);
  });

  return {
    scene, camera, pastCamera, footage, memory, pastShard, videoTexture,
    targets, frame,
    traceAt: traceAtHolder.at,
    lumaSeq,
    lumaTarget,
    lastPointerKey: "",
    lastReadErrorAt: 0,
  };
}

function lumaFrameOf(buf: Uint8Array): LumaFrame {
  // Downsample RGBA → luma (Rec. 601). The WebGPU backend pads each row of
  // copyTextureToBuffer to a 256-byte boundary (WebGPUTextureUtils), so the
  // buffer may be WIDER than width*4 bytes per row — compute the actual
  // stride from the buffer length instead of assuming tight packing.
  const texelsLaidOut = new Array<number>(LUMA_W * LUMA_H);
  const bytesPerRow = Math.max(1, Math.floor(buf.length / LUMA_H));
  const texelsPerRow = Math.floor(bytesPerRow / 4); // stride in texels
  for (let ry = 0; ry < LUMA_H; ry++) {
    const srcRow = Math.min(ry, LUMA_H - 1);
    const rowBase = srcRow * texelsPerRow;
    const dstBase = ry * LUMA_W;
    for (let x = 0; x < LUMA_W; x++) {
      const o = (rowBase + x) * 4;
      const r = buf[o];
      const g = buf[o + 1];
      const b = buf[o + 2];
      texelsLaidOut[dstBase + x] = 0.299 * (r ?? 0) + 0.587 * (g ?? 0) + 0.114 * (b ?? 0);
    }
  }
  return { pixels: texelsLaidOut, width: LUMA_W, height: LUMA_H };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<ClockRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    // boot: seed the trace as if a cut just happened so the shard is legible
    // from first frame (the "intervention trace" is the study's own hand).
    study.traceAt = performance.now();
    const memoryMat = study.memory.material as THREE.MeshBasicMaterial;
    memoryMat.map = study.targets[1 % RING]?.texture ?? null;
    memoryMat.color.set(0xffffff);

    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      onPointer(p) {
        const key = `${p.study}@${p.sha}@${p.updatedAt}`;
        if (key === study.lastPointerKey) return;
        study.lastPointerKey = key;
        // pointer cut = an intervention: durably displace the shard
        study.traceAt = performance.now();
        void sketchEvents
          .emitInfo("study", "clock04.intervention", { sha: p.sha.slice(0, 16), source: "pointer" })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        delta; // kept: signature parity with StudyRuntime
        const fm = study.footage.material as THREE.MeshBasicMaterial;
        fm.map = study.videoTexture;

        const n = study.frame.value;
        const write = study.targets[writeSlot(n, RING)];
        const read = study.targets[readSlot(n, DELAY, RING)];

        // memory panel: unchanged verified grammar
        const mat = study.memory.material as THREE.MeshBasicMaterial;
        if (read && mat.map !== read.texture) {
          mat.map = read.texture;
          mat.needsUpdate = true;
        }

        // cut detection on a tiny downsample of the CURRENT presented frame.
        // The async read resolves out of order under load — the Sequencer
        // guarantees the detector sees frames in submission order (stale
        // reads dropped, newest-wins), so no false cuts from reordering.
        r.setRenderTarget(study.lumaTarget);
        r.render(study.scene, study.pastCamera);
        r.setRenderTarget(null);
        const seqN = n;
        void r
          .readRenderTargetPixelsAsync(study.lumaTarget, 0, 0, LUMA_W, LUMA_H)
          .then((buf) => {
            study.lumaSeq.submit(seqN, buf as Uint8Array);
          })
          .catch((err: unknown) => {
            // Never silent again: emit ONCE so a dead read chain is visible
            // on the live surface instead of quietly disabling cut detection.
            const now = Date.now();
            if (now - study.lastReadErrorAt > 30_000) {
              study.lastReadErrorAt = now;
              void sketchEvents
                .emitFailure("study", "clock04.read.error", err instanceof Error ? err.message : String(err))
                .catch(() => undefined);
            }
          });

        // shard: displaced per the trace contract; texture = the past
        const trace = traceState(study.traceAt === null ? null : { at: study.traceAt }, now);
        const shardMat = study.pastShard.material as THREE.MeshBasicMaterial;
        if (trace.displacement > 0 && read) {
          if (shardMat.map !== read.texture) {
            shardMat.map = read.texture;
            shardMat.needsUpdate = true;
          }
          const d = trace.displacement;
          shardMat.visible = true;
          shardMat.opacity = 0.25 + 0.75 * d;
          // tear out along +x and toward the viewer by displacement
          study.pastShard.position.x = 0 + (SHARD_REST_X - 0) * d;
          study.pastShard.position.z = -1.9 + SHARD_DEPTH * d;
          study.pastShard.rotation.y = -0.10 * d; // slight yaw: sculpture, not sticker
        } else if (trace.displacement === 0) {
          shardMat.visible = false;
          shardMat.map = null;
          shardMat.needsUpdate = true;
          // seam at rest: the footage plane keeps a faint vertical scar
          fm.color.setRGB(1, 1, 1);
        }

        // write the CURRENT frame into the ring AFTER reads (map-before-write)
        if (write) {
          r.setRenderTarget(write);
          r.render(study.scene, study.pastCamera);
          r.setRenderTarget(null);
        }

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
        for (const t of study.targets) t.dispose();
        study.lumaTarget.dispose();
        study.footage.geometry.dispose();
        (study.footage.material as THREE.Material).dispose();
        study.memory.geometry.dispose();
        (study.memory.material as THREE.Material).dispose();
        study.pastShard.geometry.dispose();
        (study.pastShard.material as THREE.Material).dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
