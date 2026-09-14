import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";
import { DELAY, RING, type StudyScene } from "./study-recurrence";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: recursion-01 — extends recurrence-01: keeps webgpu+o11y+starter+
 * delay ring+pastCamera; changes: three-layer frame (source now / memory
 * past / live pointer cut), no captions doing the work.
 * Antecedent: Raban 2'45" (1973, LUX) — one image holding its own history.
 */

const STUDY = "recursion-01";

/** Material this study projects (catalog sha from apps/sketch/catalog.json). */
export const VIDEO: { src: string; hash: string } | null = null;

export interface StudyRuntimeRecursion extends StudyRuntime {
  /** Same-study pointer moves land here (intervention layer). */
  onPointer?(p: CurrentStudy): void;
}

interface RecursionScene extends StudyScene {
  sourcePlane: THREE.Mesh;
  pointerPlane: THREE.Mesh;
  pointerCanvas: HTMLCanvasElement;
  pointerTexture: THREE.CanvasTexture;
  flash: { until: number; level: number };
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
  // sha stripe code: 32 stripes, bit per hex pair parity
  const hex = pointer.sha.replace(/[^0-9a-f]/gi, "0").slice(0, 32);
  const stripeW = w / hex.length;
  for (let i = 0; i < hex.length; i++) {
    const v = parseInt(hex[i] ?? "0", 16);
    ctx.fillStyle = v % 2 === 0 ? "#e8f4ff" : "#9be7ff";
    const barH = 8 + (v % 4) * 10;
    ctx.fillRect(i * stripeW, (h - barH) / 2, stripeW * 0.72, barH);
  }
  // updatedAt tick marks near the bottom
  const t = new Date(pointer.updatedAt).getTime();
  const ticks = Math.max(1, Math.round((t % 3600000) / 60000));
  ctx.fillStyle = "#668899";
  for (let i = 0; i < ticks; i++) ctx.fillRect(10 + i * 14, h - 18, 8, 6);
}

function buildScene(videoTexture: THREE.VideoTexture): RecursionScene {
  const scene = new THREE.Scene();
  scene.add(new THREE.AmbientLight(0x101020, 0.5));

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.6, 7.5);
  camera.lookAt(0, 0.9, 0);

  const pastCamera = new THREE.PerspectiveCamera(38, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.set(0, 0.7, 4.2);
  pastCamera.lookAt(0, 0.6, 0);

  // Layer 1 — SOURCE: the fragment, now, directly on a plane.
  const sourcePlane = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.8),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  sourcePlane.position.set(0, 2.0, -2.2);
  scene.add(sourcePlane);

  // The knot: carries the video as its only light (keeps recurrence-01).
  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.28, 128, 24),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  knot.position.set(0, 0.6, 0);
  scene.add(knot);

  // Layer 2 — MEMORY: the recurrence-01 screen (knot's frame n-DELAY).
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(3.2, 1.8),
    new THREE.MeshBasicMaterial({ color: 0x080810 }),
  );
  screen.position.set(-3.4, 0.9, -1.4);
  scene.add(screen);

  // Layer 3 — INTERVENTION: live pointer raster; flashes on change.
  const pointerCanvas = document.createElement("canvas");
  pointerCanvas.width = 512;
  pointerCanvas.height = 192;
  const pointerTexture = new THREE.CanvasTexture(pointerCanvas);
  // critique-saved correction (recursion-01 unresolved): scale the pointer
  // plane up so the intervention layer reads at frame scale, and bias it
  // off-center so the composition doesn't dead-center it.
  const pointerPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(4.0, 1.5),
    new THREE.MeshBasicMaterial({ map: pointerTexture }),
  );
  pointerPlane.position.set(3.6, 1.05, -1.4);
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
    scene, camera, pastCamera, knot, screen, videoTexture,
    // recurrence-01's feedback mesh unused in this layout; kept off-scene
    feedbackMesh: new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial()),
    targets, frame, readIndex: frame, targetSize, targetHeight,
    sourcePlane, pointerPlane, pointerCanvas, pointerTexture, flash,
  } as RecursionScene;
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<StudyRuntimeRecursion> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    rasterizePointer(study.pointerCanvas, {
      study: STUDY,
      sha: "boot",
      updatedAt: new Date().toISOString(),
      url: "https://cinema.wzrrd.sh/",
      archive: "/archive/recursion-01/",
    } satisfies CurrentStudy);
    study.pointerTexture.needsUpdate = true;
    const screenMat = study.screen.material as THREE.MeshBasicMaterial;
    screenMat.map = study.targets[1 % RING]?.texture ?? null;
    screenMat.color.set(0xffffff);

    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    let lastPointerKey = "";
    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      onPointer(p) {
        // Every same-study pointer move is a visible cut: redraw stripes,
        // reload flash. This is the intervention layer doing its job.
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
        study.knot.rotation.x += delta * 0.4;
        study.knot.rotation.y += delta * 0.55;
        (study.sourcePlane.material as THREE.MeshBasicMaterial).map = study.videoTexture;

        // memory layer: ring write with pastCamera framing (recurrence-01 fix)
        const n = study.frame.value;
        const write = study.targets[n % RING];
        const read = study.targets[(n + 1) % RING];
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

        // intervention layer: flash decays; pointer plane redraws only on cut
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
        study.knot.geometry.dispose();
        (study.knot.material as THREE.Material).dispose();
        study.screen.geometry.dispose();
        (study.screen.material as THREE.Material).dispose();
        study.sourcePlane.geometry.dispose();
        (study.sourcePlane.material as THREE.Material).dispose();
        study.pointerPlane.geometry.dispose();
        (study.pointerPlane.material as THREE.Material).dispose();
        study.pointerTexture.dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
