import * as THREE from "three/webgpu";
import { sketchEvents } from "./lib/o11y";
import { openVideoLayer } from "./lib/video-layer";
import { DELAY, STUDY, mountScene, type StudyScene } from "./lib/study-recurrence";

/**
 * Hello world: one animated knot on a WebGPU renderer. Renderer init and the
 * frame loop emit real o11y events through the core contract — renderer init
 * is a measured hop, the loop emits a heartbeat with fps every 5 seconds,
 * and fallback (WebGL2) is explicit in metadata, never silent.
 */

const overlay = document.getElementById("overlay");
const MAX_FAILURES = 3;
let initFailures = 0;

type RenderHarness = { renderer: THREE.WebGPURenderer; backend: string };

async function initRenderer(): Promise<RenderHarness> {
  const renderer = new THREE.WebGPURenderer({ antialias: true });
  renderer.setPixelRatio(window.devicePixelRatio);
  await renderer.init();
  const backend =
    (renderer.backend as { isWebGPUBackend?: boolean }).isWebGPUBackend === true
      ? "webgpu"
      : "webgl2-fallback";
  return { renderer, backend };
}

try {
  const { renderer, backend } = await sketchEvents.measured(
    "webgpu-renderer",
    "renderer.initialize",
    { surface: window.innerWidth >= 1024 ? "desktop" : "compact" },
    async () => initRenderer(),
  );

  document.body.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06060a);

  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0, 0);

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(1, 0.28, 128, 24),
    new THREE.MeshStandardMaterial({ color: 0x9be7ff, roughness: 0.35, metalness: 0.6 }),
  );
  scene.add(knot);

  const key = new THREE.DirectionalLight(0xffffff, 3);
  key.position.set(3, 4, 5);
  scene.add(key);
  scene.add(new THREE.AmbientLight(0x222244, 0.9));

  // Study: recurrence-01. The knot receives the video as its only light
  // (map, not lit material); the screen shows the scene's own past via a
  // 24-frame render-target delay ring. Lineage: hello-world-knot.
  let study: StudyScene | null = null;
  openVideoLayer()
    .then(async (layer) => {
      if (!layer) return;
      study = await mountScene(renderer, layer);
      sketchEvents
        .emitInfo("study", "study.scene.live", { study: STUDY, delay: DELAY })
        .catch(() => undefined);
    })
    .catch(() => {
      // openVideoLayer / mountScene already emit their own failure envelopes
    });

  if (overlay) {
    overlay.textContent = `expanded cinema · ${STUDY} · extends hello-world-knot: keeps webgpu+o11y+starter; changes knot-as-screen-surface, self-delayed view · ${backend}`;
  }

  function resize(): void {
    renderer.setSize(window.innerWidth, window.innerHeight);
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    try {
      sketchEvents.emitInfo("webgpu-renderer", "viewport.resized", {
        width: window.innerWidth,
        height: window.innerHeight,
      });
    } catch {
      // telemetry must never break the sketch
    }
  }
  window.addEventListener("resize", resize);
  resize();

  let previous = performance.now();
  let framesSinceHeartbeat = 0;
  let heartbeatStart = performance.now();

  renderer.setAnimationLoop((now: number) => {
    const delta = (now - previous) / 1000;
    previous = now;
    if (study) {
      study.knot.rotation.x += delta * 0.4;
      study.knot.rotation.y += delta * 0.55;
      study.screen.rotation.y = Math.sin(now / 2400) * 0.18;

      // Rephotography: render the scene to the ring's write target, then
      // swap read/write so the screen always shows DELAY-frames-ago.
      const write = study.targets[study.readIndex.value % study.targets.length];
      if (write) {
        renderer.setRenderTarget(write);
        renderer.render(study.scene, study.camera);
        renderer.setRenderTarget(null);
        study.readIndex.value = (study.readIndex.value + 1) % study.targets.length;
        const read = study.targets[study.readIndex.value];
        const mat = study.screen.material as THREE.MeshBasicMaterial;
        mat.map = read?.texture ?? null;
        mat.needsUpdate = true;
      }
      // Give the present scene a final render to the canvas so what the
      // viewer sees is the CURRENT frame plus a screen showing the past.
      renderer.render(study.scene, study.camera);
    }
    framesSinceHeartbeat++;

    if (now - heartbeatStart >= 5000) {
      const fps = framesSinceHeartbeat / ((now - heartbeatStart) / 1000);
      framesSinceHeartbeat = 0;
      heartbeatStart = now;
      sketchEvents
        .emitInfo("webgpu-renderer", "frame.heartbeat", {
          fps: Math.round(fps * 10) / 10,
          backend,
          pixelRatio: window.devicePixelRatio,
        })
        .catch(() => {
          // telemetry must never break the sketch
        });
    }

    if (!study) {
      // fallback: dark scene, study.load failure already reported
      renderer.render(scene, camera);
    }

  });
} catch (initError) {
  initFailures++;
  await sketchEvents.emitFailure(
    "webgpu-renderer",
    "renderer.initialize",
    initError instanceof Error ? initError.message : String(initError),
    { failures: initFailures, ceiling: MAX_FAILURES },
  );
  if (overlay) {
    overlay.textContent = `expanded cinema · renderer failed: ${initError instanceof Error ? initError.message : "unknown"}`;
  }
}
