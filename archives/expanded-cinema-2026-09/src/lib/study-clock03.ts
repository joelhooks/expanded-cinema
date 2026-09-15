import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: clock-03 — extends clock-02 per its critique's open question.
 * Question: should the intervention layer interrupt the footage itself
 * instead of sitting beside it as an instrument panel?
 * Operation: on every same-study pointer move, the pointer sha drives a
 * vertical waterfall wipe across the central footage — a band where the
 * PAST (memory ring texture sampled at wipe position) replaces the now,
 * decaying over ~700ms. The gallery's own clock cuts into the archive,
 * exactly as the film interrupted its workers.
 * Antecedent: the film's own title cards interrupting lived time.
 */

const STUDY = "clock-03";

/** Bigger delay than the recurrence family: ~3s of lag, visible as motion mismatch. */
const DELAY = 180;
const RING = DELAY + 1;

/** Material this study projects (catalog sha from apps/sketch/catalog.json). */
export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

export interface ClockRuntime extends StudyRuntime {
  onPointer?(p: CurrentStudy): void;
}

function rasterizePointer(
  canvas: HTMLCanvasElement,
  pointer: CurrentStudy,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  ctx.fillStyle = "#05050a";
  ctx.fillRect(0, 0, w, h);
  const hex = pointer.sha.replace(/[^0-9a-f]/gi, "0").slice(0, 32);
  const stripeW = w / hex.length;
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i] ?? "0", 16);
    ctx.fillStyle = v % 2 === 0 ? "#e8f4ff" : "#9be7ff";
    const barH = 8 + (v % 4) * 10;
    ctx.fillRect(i * stripeW, (h - barH) / 2, stripeW * 0.72, barH);
  }
  const t = new Date(pointer.updatedAt).getTime();
  const ticks = Math.max(1, Math.round((t % 3600000) / 60000));
  ctx.fillStyle = "#668899";
  for (let i = 0; i < ticks; i++) ctx.fillRect(10 + i * 14, h - 18, 8, 6);
}

interface ClockScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pastCamera: THREE.PerspectiveCamera;
  footage: THREE.Mesh;
  memory: THREE.Mesh;
  wipeBand: THREE.Mesh;
  videoTexture: THREE.VideoTexture;
  targets: THREE.RenderTarget[];
  frame: { value: number };
  pointerPlane: THREE.Mesh;
  pointerCanvas: HTMLCanvasElement;
  pointerTexture: THREE.CanvasTexture;
  flash: { until: number; level: number };
  /** Waterfall wipe: progress 0..1 across the footage, active while >0. */
  wipe: { until: number; span: number; seed: number };
}

function buildScene(videoTexture: THREE.VideoTexture): ClockScene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x101020, 0.5));

  // Protagonist framing: the archive footage owns the frame, centered.
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 6.6);
  camera.lookAt(0, 1.0, 0);

  const pastCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.set(0, 1.0, 6.6);
  pastCamera.lookAt(0, 1.0, 0);

  // The footage, now: large, central, slightly recessed.
  const footage = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.15),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  footage.position.set(0, 1.0, -2.0);
  scene.add(footage);

  // The wipe band: a vertical slice that can overlay the footage with the
  // PAST (memory texture). Positioned/scaled per pointer-cut progress.
  const wipeBand = new THREE.Mesh(
    new THREE.PlaneGeometry(0.9, 3.15),
    new THREE.MeshBasicMaterial({ color: 0x08080f, transparent: true, opacity: 0 }),
  );
  wipeBand.position.set(0, 1.0, -1.9);
  wipeBand.visible = false;
  scene.add(wipeBand);

  // The footage, then: the SAME view, DELAY frames late (ring capture).
  const memory = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.575),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  memory.position.set(-4.35, 0.9, 0.6);
  scene.add(memory);

  // Intervention layer: live pointer raster; flashes on change.
  const pointerCanvas = document.createElement("canvas");
  pointerCanvas.width = 512;
  pointerCanvas.height = 192;
  const pointerTexture = new THREE.CanvasTexture(pointerCanvas);
  const pointerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.5),
    new THREE.MeshBasicMaterial({ map: pointerTexture }),
  );
  pointerPlane.position.set(4.1, 1.05, -1.4);
  scene.add(pointerPlane);

  const flash = { until: 0, level: 0 };

  const targetSize = 640;
  const targetHeight = Math.round((targetSize * window.innerHeight) / window.innerWidth);
  const targets = Array.from(
    { length: RING },
    () => new THREE.RenderTarget(targetSize, targetHeight, { depthBuffer: false }),
  );
  const frame = { value: 0 };

  return {
    scene, camera, pastCamera, footage, memory, videoTexture,
    targets, frame,
    wipeBand,
    pointerPlane, pointerCanvas, pointerTexture, flash,
    wipe: { until: 0, span: 0.28, seed: 0 },
  };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<ClockRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    rasterizePointer(study.pointerCanvas, {
      study: STUDY,
      sha: "boot",
      updatedAt: new Date().toISOString(),
      url: "https://cinema.wzrrd.sh/",
      archive: "/archive/clock-01/",
    } satisfies CurrentStudy);
    study.pointerTexture.needsUpdate = true;
    const memoryMat = study.memory.material as THREE.MeshBasicMaterial;
    memoryMat.map = study.targets[1 % RING]?.texture ?? null;
    memoryMat.color.set(0xffffff);

    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    let lastPointerKey = "";
    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      onPointer(p) {
        const key = `${p.study}@${p.sha}@${p.updatedAt}`;
        if (key === lastPointerKey) return;
        lastPointerKey = key;
        rasterizePointer(study.pointerCanvas, p);
        study.pointerTexture.needsUpdate = true;
        study.flash.until = performance.now() + 700;
        // clock-03: the intervention interrupts the footage itself. Sha
        // bytes pick where the waterfall starts; the band sweeps the plane.
        const b0 = parseInt(p.sha.replace(/[^0-9a-f]/gi, "0")[0] ?? "0", 16) / 15;
        study.wipe.until = performance.now() + 700;
        study.wipe.seed = b0 * (1 - study.wipe.span);
        void sketchEvents
          .emitInfo("study", "clock03.wipe", { sha: p.sha.slice(0, 16), start: Number(b0.toFixed(2)) })
          .catch(() => undefined);
        void sketchEvents
          .emitInfo("study", "recursion.pointerCut", { sha: p.sha.slice(0, 16) })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        (study.footage.material as THREE.MeshBasicMaterial).map = study.videoTexture;

        // clock-03: waterfall wipe — the intervention cuts into the archive.
        const fm = study.footage.material as THREE.MeshBasicMaterial;
        const GEO_W = 5.6;
        if (now < study.wipe.until) {
          const p = (study.wipe.until - now) / 700; // 1 → 0, decays
          const c = study.wipe.seed + (1 - p) * study.wipe.span; // sweeps L→R
          const w = study.wipe.span * GEO_W;
          study.wipeBand.visible = true;
          study.wipeBand.scale.set(study.wipe.span, 1, 1);
          // footage spans x ∈ [-GEO_W/2, +GEO_W/2]; band centered at edge c
          study.wipeBand.position.x = (c - 0.5) * GEO_W;
          const wm = study.wipeBand.material as THREE.MeshBasicMaterial;
          // band shows the PAST: latest readable ring texture (delay ~1 ring
          // step behind by construction, readable cheaply) with wipe-tinted
          // amber so the interruption reads as a CUT, not a shadow
          const readTex = study.targets[(study.frame.value + 1 - DELAY + RING) % RING]?.texture ?? null;
          if (readTex && wm.map !== readTex) {
            wm.map = readTex;
            wm.needsUpdate = true;
          }
          wm.color.setRGB(1.35, 1.05, 0.85); // warm cut flash tint
          wm.opacity = 0.55 + 0.45 * p;
          fm.color.setRGB(1.2, 1.2, 1.2);
        } else {
          study.wipeBand.visible = false;
          const wm = study.wipeBand.material as THREE.MeshBasicMaterial;
          wm.map = null;
          wm.needsUpdate = true;
          fm.color.setRGB(1, 1, 1);
        }

        // memory layer: same-view ring capture; the panel reads DELAY late,
        // so past vs present sit side by side and the lag is visible.
        const n = study.frame.value;
        const write = study.targets[n % RING];
        const read = study.targets[(n + 1) % RING];
        const mat = study.memory.material as THREE.MeshBasicMaterial;
        if (read && mat.map !== read.texture) {
          mat.map = read.texture;
          mat.needsUpdate = true;
        }
        if (write) {
          r.setRenderTarget(write);
          r.render(study.scene, study.pastCamera);
          r.setRenderTarget(null);
        }

        study.flash.level = now < study.flash.until ? Math.min(1, (study.flash.until - now) / 350) : 0;
        const pm = (study.pointerPlane.material as THREE.MeshBasicMaterial) ?? null;
        if (pm) {
          pm.color.setRGB(1 + study.flash.level * 2, 1 + study.flash.level * 2, 1 + study.flash.level * 2);
        }

        r.render(study.scene, study.camera);
        study.frame.value = n + 1;
      },
      onResize(w: number, h: number) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
        study.pastCamera.aspect = w / h;
        study.pastCamera.updateProjectionMatrix();
      },
      dispose() {
        for (const t of study.targets) t.dispose();
        study.footage.geometry.dispose();
        (study.footage.material as THREE.Material).dispose();
        study.memory.geometry.dispose();
        (study.memory.material as THREE.Material).dispose();
        study.wipeBand.geometry.dispose();
        (study.wipeBand.material as THREE.Material).dispose();
        study.pointerPlane.geometry.dispose();
        (study.pointerPlane.material as THREE.Material).dispose();
        study.pointerTexture.dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
