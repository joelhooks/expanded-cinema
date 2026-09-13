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
const STUDY = "recurrence-01";

export interface StudyScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  knot: THREE.Mesh;
  screen: THREE.Mesh;
  videoTexture: THREE.VideoTexture;
  feedbackMesh: THREE.Mesh;
  targets: THREE.RenderTarget[];
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
  const targets = Array.from({ length: DELAY }, () => new THREE.RenderTarget(targetSize, targetHeight, { depthBuffer: false }));
  const readIndex = { value: 0 };

  return { scene, camera, knot, screen, videoTexture, feedbackMesh, targets, readIndex, targetSize, targetHeight };
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
      // frames ago. The composite happens in the animation loop (caller).
      const screenMat = study.feedbackMesh.material as THREE.MeshBasicMaterial;
      screenMat.map = study.targets[study.readIndex.value]?.texture ?? null;
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

export { DELAY, STUDY };
