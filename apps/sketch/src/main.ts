import * as THREE from "three/webgpu";
import { sketchEvents } from "./lib/o11y";
import { openVideoLayer } from "./lib/video-layer";
import { fetchCurrent, watchCurrent, type CurrentStudy } from "./lib/gallery-store";
import { mountRuntime, type StudyRuntime } from "./lib/study-recurrence";

/**
 * Expanded Cinema: a WebGPU gallery whose current study is a runtime
 * pointer, not a build artifact. The page boots from content/current.json
 * (served through the /archive gateway) and hot-swaps when the pointer
 * moves — an already-open tab picks a new study up without a redeploy.
 */

const overlay = document.getElementById("overlay");
const MAX_FAILURES = 3;
let initFailures = 0;

type RenderHarness = { renderer: THREE.WebGPURenderer; backend: string };

/**
 * Study registry: each shipped study registers a loader keyed by its id.
 * A pointer move to a registered id needs no code push; registering a
 * NEW study id is a code push (the archive route serves arbitrary study
 * URLs regardless — /archive/<study>/<sha>/ works for every shipped
 * bundle, registry or not).
 */
const STUDY_LOADERS: Record<
  string,
  () => Promise<{ mountRuntime: typeof mountRuntime; STUDY: string }>
> = {
  "recurrence-01": () => import("./lib/study-recurrence"),
};

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

  // Gallery state: the live study exists only behind this variable. The
  // boot pointer comes from the runtime store; watchCurrent hot-swaps in
  // an already-open tab when it moves. A failed look falls back to the
  // last registered study so the page never boots dark.
  let study: StudyRuntime | null = null;
  let layer: Awaited<ReturnType<typeof openVideoLayer>> = null;

  const FALLBACK_POINTER: CurrentStudy = {
    study: "recurrence-01",
    sha: "bundle",
    updatedAt: "1970-01-01T00:00:00Z",
    url: "https://cinema.wzrrd.sh/",
    archive: "/archive/recurrence-01/",
  };

  async function mountStudy(pointer: CurrentStudy): Promise<boolean> {
    const loader = STUDY_LOADERS[pointer.study];
    if (!loader) {
      void sketchEvents
        .emitInfo("gallery", "gallery.study.unknown", { study: pointer.study })
        .catch(() => undefined);
      return false;
    }
    if (!layer) return false;
    const mod = await loader();
    const next = await mod.mountRuntime(renderer, layer);
    study = next;
    if (overlay) {
      overlay.textContent = `expanded cinema · ${pointer.study} · live pointer ${pointer.sha.slice(0, 7)} · ${backend}`;
    }
    void sketchEvents
      .emitInfo("study", "study.scene.live", { study: pointer.study, pointer: pointer.sha })
      .catch(() => undefined);
    return true;
  }

  layer = await openVideoLayer().catch(() => null);
  const booted = (await fetchCurrent()) ?? FALLBACK_POINTER;
  await mountStudy(booted);
  // One watcher for the surface lifetime: pointer moves dismount the old
  // runtime and mount the new one in the same loop.
  watchCurrent(booted, async (next, previous) => {
    const old = study;
    study = null;
    if (await mountStudy(next).catch(() => false)) {
      old?.dispose();
      void sketchEvents
        .emitInfo("gallery", "gallery.study.swapped.applied", {
          from: `${previous.study}@${previous.sha.slice(0, 7)}`,
          to: `${next.study}@${next.sha.slice(0, 7)}`,
        })
        .catch(() => undefined);
    } else {
      study = old;
    }
  });

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
      study.step(renderer, now, delta);
    } else {
      // fallback: dark scene, study.load failure already reported
      renderer.render(scene, camera);
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
