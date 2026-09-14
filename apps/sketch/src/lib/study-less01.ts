import * as THREE from "three/webgpu";
import { ringLength, writeSlot, readSlot } from "@expanded-cinema/core";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";

/**
 * Study: less-01 — nothing added. Pure-subtraction slot per the
 * 2026-09-13 "do less on purpose" provocation (queue: state/remake files
 * and .brain/resources/study-queue.svx): clock-02's verified grammar with
 * EVERY gallery overlay except the lag panel deleted — no wipe band, no
 * pointer raster plane, no title tag geometry, no flash. What remains:
 * the footage plane and the same-view DELAY ring panel.
 *
 * Acceptance evidence is comparative: side-by-side against the clock-02
 * archive (/archive/clock-02/076405c/) — the hard-cut motion mismatch must
 * remain visible with strictly less apparatus. The artistic question: is
 * the remaining image MORE legible as expanded cinema, or does it collapse
 * back into television?
 */

const STUDY = "less-01";
const DELAY = 180;
const RING = ringLength(DELAY); // 181 — invariant from core

/** Material this study projects (same cut; catalog sha from apps/sketch/catalog.json). */
export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

export interface LessRuntime extends StudyRuntime {
  onResize(w: number, h: number): void;
  dispose(): void;
}

interface LessScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pastCamera: THREE.PerspectiveCamera;
  footage: THREE.Mesh;
  memory: THREE.Mesh;
  videoTexture: THREE.VideoTexture;
  targets: THREE.RenderTarget[];
  frame: { value: number };
}

function buildScene(videoTexture: THREE.VideoTexture): LessScene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x101020, 0.5));

  // Composition identical to clock-02 (comparability is the acceptance
  // evidence; nothing about framing is an addition).
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 6.6);
  camera.lookAt(0, 1.0, 0);

  const pastCamera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.set(0, 1.0, 6.6);
  pastCamera.lookAt(0, 1.0, 0);

  const footage = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.15),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  footage.position.set(0, 1.0, -2.0);
  scene.add(footage);

  // The one retained element: SAME view, DELAY frames late.
  const memory = new THREE.Mesh(
    new THREE.PlaneGeometry(2.8, 1.575),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  memory.position.set(-4.35, 0.9, 0.6);
  scene.add(memory);

  const targetSize = 640;
  const targetHeight = Math.round((targetSize * window.innerHeight) / window.innerWidth);
  const targets = Array.from(
    { length: RING },
    () => new THREE.RenderTarget(targetSize, targetHeight, { depthBuffer: false }),
  );
  const frame = { value: 0 };

  return { scene, camera, pastCamera, footage, memory, videoTexture, targets, frame };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<LessRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    const memoryMat = study.memory.material as THREE.MeshBasicMaterial;
    memoryMat.map = study.targets[1 % RING]?.texture ?? null;
    memoryMat.color.set(0xffffff);

    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      // No onPointer: the overlay layers are gone; pointer cuts are carried
      // ONLY by the global pointer poll up in main.ts firing gallery events.
      step(r) {
        (study.footage.material as THREE.MeshBasicMaterial).map = study.videoTexture;

        // same-view ring capture: the verified grammar, unchanged.
        const n = study.frame.value;
        const write = study.targets[writeSlot(n, RING)];
        const read = study.targets[readSlot(n, DELAY, RING)];
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
        study.footage.geometry.dispose();
        (study.footage.material as THREE.Material).dispose();
        study.memory.geometry.dispose();
        (study.memory.material as THREE.Material).dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
