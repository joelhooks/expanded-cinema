import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: clock-02 — extends clock-01 per its critique's open question.
 * Question: can the memory layer SHOW its delay (a visible mismatch between
 * now and n−DELAY), and can the archive footage be the protagonist instead
 * of flanking a knot?
 * Operation: the 1943 footage fills the frame (central plane). The memory
 * panel beside it renders the SAME view DELAY frames late, so past vs
 * present are directly comparable — the lag is visible as motion mismatch.
 * The knot is removed (subtraction is the critique's ask).
 */

const STUDY = "clock-02";

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
  videoTexture: THREE.VideoTexture;
  targets: THREE.RenderTarget[];
  frame: { value: number };
  pointerPlane: THREE.Mesh;
  pointerCanvas: HTMLCanvasElement;
  pointerTexture: THREE.CanvasTexture;
  flash: { until: number; level: number };
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
    pointerPlane, pointerCanvas, pointerTexture, flash,
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
        void sketchEvents
          .emitInfo("study", "recursion.pointerCut", { sha: p.sha.slice(0, 16) })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        (study.footage.material as THREE.MeshBasicMaterial).map = study.videoTexture;

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
        study.pointerPlane.geometry.dispose();
        (study.pointerPlane.material as THREE.Material).dispose();
        study.pointerTexture.dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
