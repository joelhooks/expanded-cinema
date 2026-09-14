import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";

/**
 * Study: recurrence-01 (rephotography).
 *
 * Lineage: hello-world-knot. Keeps: the WebGPU renderer, the o11y chain,
 * the starter clip. Changes: the knot receives the video as its only
 * light (no key light, no fill); the projection screen shows the scene's
 * own past — every frame is rendered to a texture and a delayed copy
 * (DELAY frames) feeds the screen. The screen displays the work seeing
 * itself late.
 */

const DELAY = 24;
function targetAspectRatio(): number {
  return window.innerWidth / window.innerHeight;
}
/**
 * Ring length must exceed the delay: with length == DELAY the target we
 * want to read is always the one being written this frame, which WebGPU
 * rejects (render-attachment + texture-binding in one scope). One extra
 * slot keeps read and write永远 distinct.
 */
const RING = DELAY + 1;
const STUDY = "recurrence-01";

export interface StudyScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pastCamera: THREE.PerspectiveCamera;
  knot: THREE.Mesh;
  screen: THREE.Mesh;
  videoTexture: THREE.VideoTexture;
  feedbackMesh: THREE.Mesh;
  targets: THREE.RenderTarget[];
  /** Monotonic frame counter; write = targets[frame % RING]. */
  frame: { value: number };
  readIndex: { value: number };
  targetSize: number;
  targetHeight: number;
}

function buildScene(videoTexture: THREE.VideoTexture): StudyScene {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x030308);
  scene.add(new THREE.AmbientLight(0x0a0a12, 0.35));

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0.6, 0);

  // recurrence-02: past-camera — a dedicated close-up on the knot only,
  // used for the delay-ring capture so the screen shows the KNOT's past
  // (frame n-DELAY), not the scene's mostly-background past. This is the
  // readability fix from the 5c3d040 critique.
  const pastCamera = new THREE.PerspectiveCamera(38, targetAspectRatio(), 0.1, 100);
  pastCamera.position.set(0, 0.7, 4.2);
  pastCamera.lookAt(0, 0.6, 0);

  // The knot's only light is the moved image: an emissive screen behind it
  // plus the video texture as its map — the surface *carries* the source.
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.28, 128, 24),
    new THREE.MeshBasicMaterial({ map: videoTexture, color: 0xffffff }),
  );
  knot.position.set(0, 0.6, 0);
  scene.add(knot);

  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  screen.position.set(0, 1.1, -1.4);
  scene.add(screen);

  // Feedback plane: not added to the visible scene yet — swapped in when the
  // delay chain fills (the caller wires it).
  const feedbackMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  feedbackMesh.position.copy(screen.position);
  feedbackMesh.rotation.copy(screen.rotation);

  const targetSize = 640;
  const targetHeight = Math.round((targetSize * window.innerHeight) / window.innerWidth);
  const targets = Array.from({ length: RING }, () => new THREE.RenderTarget(targetSize, targetHeight, { depthBuffer: false }));
  const frame = { value: 0 };
  const readIndex = { value: 0 };

  return { scene, camera, pastCamera, knot, screen, videoTexture, feedbackMesh, targets, frame, readIndex, targetSize, targetHeight };
}

export async function mountScene(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<StudyScene> {
  return await sketchEvents.measured(
    "study",
    "study.mount",
    { study: STUDY, delayFrames: DELAY },
    async () => {
      const study = buildScene(videoLayer.texture);

      // Wire the feedback loop: the screen shows the target written DELAY
      // frames ago. Initially that is targets[1] (targets[0] is written
      // this frame and must never be sampled while attached). The composite
      // happens in the animation loop (caller).
      const screenMat = study.feedbackMesh.material as THREE.MeshBasicMaterial;
      screenMat.map = study.targets[1 % RING]?.texture ?? null;
      screenMat.color.set(0xffffff);
      sceneSwap(study);

      sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);
      return study;
    },
  );
}

function sceneSwap(study: StudyScene): void {
  // Replace the placeholder screen mesh with the feedback mesh that reads
  // from the ring. The screen IS the feedback surface in this study.
  const scene = study.scene;
  scene.remove(study.screen);
  scene.add(study.feedbackMesh);
  study.screen = study.feedbackMesh;
}

/**
 * Swappable runtime surface the gallery layer owns: one step per frame,
 * one dispose on hot-swap. main.ts never touches study internals — that
 * is what lets a study change under an open tab without a redeploy.
 */
export interface StudyRuntime {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  delay: number;
  step(renderer: THREE.WebGPURenderer, now: number, delta: number): void;
  dispose(): void;
  onResize?(w: number, h: number): void;
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<StudyRuntime> {
  const study = await mountScene(renderer, videoLayer);
  const allTargets = study.targets;
  return {
    scene: study.scene,
    camera: study.camera,
    delay: DELAY,
    step(r, now, delta) {
      study.knot.rotation.x += delta * 0.4;
      study.knot.rotation.y += delta * 0.55;
      study.screen.rotation.y = Math.sin(now / 2400) * 0.18;

      // recurrence-02: the delay ring captures the PAST-camera framing
      // (knot close-up) — the screen shows the knot frame n-DELAY, at
      // readable scale. Same ordering discipline as 5c3d040: map moves
      // BEFORE the write pass, never same-texture in one scope.
      const n = study.frame.value;
      const write = allTargets[n % RING];
      const read = allTargets[(n + 1) % RING];
      const mat = study.screen.material as THREE.MeshBasicMaterial;
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
    dispose() {
      for (const t of allTargets) t.dispose();
      study.knot.geometry.dispose();
      (study.knot.material as THREE.Material).dispose();
      study.screen.geometry.dispose();
      (study.screen.material as THREE.Material).dispose();
    },
  };
}

export { DELAY, RING, STUDY };
