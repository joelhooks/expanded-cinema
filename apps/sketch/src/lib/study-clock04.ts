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
  sourceNow: THREE.Mesh;
  sourceThen: THREE.Mesh;
  screen: THREE.Mesh;
  proj1: THREE.Mesh;
  proj2: THREE.Mesh;
  canvases: THREE.Mesh[];
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
  lumaFrameSample: Uint8Array | null;
}

/** Beam rig geometry (mirrors clock-02/03's scene scale for archive comparability). */
const LUMA_W = 32;
const LUMA_H = 18;
const SLICES = 200;
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

  // invisible luma sources: two unlit quads, one live, one delayed — these
  // are what pastCamera rasterizes into the ring for luma sampling
  const hidden = new THREE.MeshBasicMaterial({ colorWrite: false, depthWrite: false });
  const sourceNow = new THREE.Mesh(new THREE.PlaneGeometry(FM_U, FM_V), hidden);
  sourceNow.material.map = null;
  sourceNow.position.set(0, 4.5, 0);
  sourceNow.renderOrder = -1;
  scene.add(sourceNow);

  const sourceThen = new THREE.Mesh(new THREE.PlaneGeometry(FM_U, FM_V), hidden);
  sourceThen.position.set(0, 4.5, 0);
  sourceThen.renderOrder = -1;
  scene.add(sourceThen);

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
  const screenMat = new THREE.MeshLambertMaterial({
    color: 0xf2f4f8,
    emissive: 0x101014,
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
  let lumaFramesSeen = 0;
  const traceAtHolder: { at: number | null } = { at: null };
  const sampleHolder: { sample: Uint8Array | null } = { sample: null };
  const lumaSeq = new Sequencer<Uint8Array>((buf: Uint8Array) => {
    sampleHolder.sample = buf;
    // luma-chain diagnostic: every ~10s, emit what the detector actually
    // sees (mean luma + buffer length). Distinguishes "reads resolve but
    // constant" from "reads dead" on the live console — verification evidence,
    // not per-frame noise (removable once clock-04's shard gate passes).
    lumaFramesSeen++;
    if (lumaFramesSeen % 600 === 1) {
      let sum = 0;
      for (let i = 0; i < buf.length; i += 4) sum += buf[i] ?? 0;
      const frame = lumaFrameOf(buf);
      let lumaSum = 0;
      for (const v of frame.pixels) lumaSum += v;
      void sketchEvents
        .emitInfo("study", "clock04.luma.stats", {
          seen: lumaFramesSeen,
          bufLen: buf.length,
          meanR: Number((sum / (buf.length / 4)).toFixed(1)),
          meanLuma: Number((lumaSum / frame.pixels.length).toFixed(1)),
        })
        .catch(() => undefined);
    }
    const cut = cutDetector.push(lumaFrameOf(buf));
    if (!cut) return;
    traceAtHolder.at = performance.now();
    void sketchEvents
      .emitInfo("study", "clock04.shard", { at: Number(traceAtHolder.at.toFixed(0)), source: "cut" })
      .catch(() => undefined);
  });

  return {
    scene,
    camera,
    pastCamera,
    sourceNow,
    sourceThen,
    screen,
    proj1,
    proj2,
    canvases,
    targets,
    frame,
    traceAt: traceAtHolder.at,
    lumaSeq,
    lumaTarget,
    lastPointerKey: "",
    lastReadErrorAt: 0,
    lumaFrameSample: sampleHolder.sample,
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
    const study = buildScene();
    study.sourceNow.material.map = videoLayer.texture;
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
        void delta; // signature parity with StudyRuntime
        study.sourceNow.material.map = videoLayer.texture;

        const n = study.frame.value;
        const write = study.targets[writeSlot(n, RING)];
        const read = study.targets[readSlot(n, DELAY, RING)];

        // cut detection on a tiny downsample of the luma sources.
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

        // camera drift: slow arc, ~20 degrees over 30s, breathing height
        const phase = (now % 30_000) / 30_000;
        const ang = (phase * Math.PI) / 9 - Math.PI / 18; // ±10 deg
        const camR = 5.9;
        study.camera.position.set(
          0.4 + Math.sin(ang) * camR,
          0.85 + Math.sin((now / 5200) % (Math.PI * 2)) * 0.18,
          0.4 + Math.cos(ang) * camR,
        );
        study.camera.lookAt(-0.5, 1.1, 0);

        // per-slice: aim each quad from its beam origin at the curved screen,
        // brightness = film luma at that slice's row (ring-late for beam 1)
        const liveTex = study.sourceNow.material.map as THREE.VideoTexture | null;
        const pastTex = (read?.texture ?? null) as THREE.Texture | null;
        const lumaBuf = study.lumaFrameSample;
        for (const m of study.canvases) {
          const { beam, idx, yMid } = m.userData as { beam: number; idx: number; yMid: number };
          const org = beam === 0 ? PROJ : PROJ_OFF;
          // target point on the screen: cylinder parametric axis point
          const u = -0.02 + yMid * 0.16; // aim spread across screen height
          const sx = SCREEN_R * Math.sin(u);
          const sz = SCREEN_R * Math.cos(u) - 2.2;
          const dir = new THREE.Vector3(sx - org.x, 1.1 + yMid - org.y, sz - org.z);
          const len = dir.length();
          m.position.copy(org).addScaledVector(dir, 0.5);
          m.scale.set(len, 1, 1);
          m.visible = true;
          // face the beam: rotate to align the quad's +x with dir
          const yaw = Math.atan2(dir.z, dir.x);
          const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
          m.rotation.set(0, -yaw, pitch);
          m.rotateY(Math.PI / 2);
          // brightness: split the luma buffer into SLICES bands, live or past
          const tex = beam === 0 ? liveTex : pastTex;
          void tex;
          const base = idx * SLICE_BAND * 4;
          let acc = 0;
          if (lumaBuf) {
            for (let k = 0; k < SLICE_BAND * 4; k += 4) acc += lumaBuf[base + k] ?? 0;
            acc /= SLICE_BAND;
          }
          const bright = Math.min(1, (acc / 255) * 2.4);
          mat: {
            const mm = m.material as THREE.MeshBasicMaterial;
            mm.opacity = beam === 0 ? 0.16 + bright * 0.7 : 0.05 + bright * 0.28;
          }
        }

        // lens breathing: projectors inhale on their own cadence
        const pulse = Math.sin((now / 2400) % (Math.PI * 2)) * 0.5 + 0.5;
        (study.proj1.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + pulse * 0.4;
        (study.proj2.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.2 + (1 - pulse) * 0.3;

        // write the CURRENT luma view into the ring AFTER reads (map-before-write)
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
