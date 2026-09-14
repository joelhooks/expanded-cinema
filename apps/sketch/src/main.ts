import * as THREE from "three/webgpu";
import { sketchEvents } from "./lib/o11y";
import { openVideoLayer } from "./lib/video-layer";
import { useVideoLayerState } from "./state/videoLayerState";
import { fetchCurrent, watchCurrent, POLL_INTERVAL_MS, type CurrentStudy } from "./lib/gallery-store";
import { mountRuntime, type StudyRuntimeRecursion } from "./lib/study-recursion";

/**
 * Study: recursion-01 — three temporal layers in one frame, no captions:
 * source (video now), memory (surface's retained past via delay ring),
 * intervention (live pointer cut rasterized as image). Antecedent: Raban
 * 2'45" (1973, LUX-verified). Art direction carried: distinguish the three
 * in one frame WITHOUT overlay text. Overlay shows only the minimal id.
 */

const overlay = document.getElementById("overlay");
const MAX_FAILURES = 3;
let initFailures = 0;

type RenderHarness = { renderer: THREE.WebGPURenderer; backend: string };

const STUDY_LOADERS: Record<
  string,
  () => Promise<{
    mountRuntime: typeof mountRuntime;
    STUDY: string;
    VIDEO: { src: string; hash: string } | null;
  }>
> = {
  // The archive route serves every shipped study bundle regardless of this
  // registry; the registry only gates what a pointing tab can mount.
  "recurrence-01": () => import("./lib/study-recurrence"),
  "recursion-01": () => import("./lib/study-recursion"),
  "clock-01": () => import("./lib/study-clock"),
  "clock-02": () => import("./lib/study-clock02"),
  "clock-03": () => import("./lib/study-clock03"),
  "clock-04": () => import("./lib/study-clock04"),
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

  // Fallback dark scene shown only if the pointer resolves to nothing mountable.
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06060a);
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.2, 6);
  camera.lookAt(0, 0, 0);

  let study: StudyRuntimeRecursion | null = null;
  let layer: Awaited<ReturnType<typeof openVideoLayer>> = null;

  const FALLBACK_POINTER: CurrentStudy = {
    study: "recursion-01",
    sha: "bundle",
    updatedAt: "1970-01-01T00:00:00Z",
    url: "https://cinema.wzrrd.sh/",
    archive: "/archive/recursion-01/",
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
    // Each study declares its material (VIDEO). If the open layer's source
    // doesn't match, close it and open the study's own — per-study material,
    // shared temporal machinery.
    const videoDecl = mod.VIDEO ?? null;
    const layerSrc = useVideoLayerState.getState().currentSrc ?? "";
    if (videoDecl && !layerSrc.endsWith(videoDecl.src)) {
      // Study wants material the open layer isn't playing: tear the old
      // element down fully (element + texture) and open its own — per-study
      // material, shared temporal machinery, no dead_VIDEO elements left in
      // the document.
      layer.dispose();
      layer = await openVideoLayer(videoDecl).catch(() => null);
      if (!layer) return false;
      void sketchEvents
        .emitInfo("study", "study.material.swapped", { study: pointer.study, src: videoDecl.src })
        .catch(() => undefined);
    }
    if (!layer) return false;
    const next = await mod.mountRuntime(renderer, layer);
    // Only the study's short id, never marketing copy (art direction).
    if (overlay) overlay.textContent = pointer.study;
    void sketchEvents
      .emitInfo("study", "study.scene.live", { study: pointer.study, pointer: pointer.sha })
      .catch(() => undefined);
    study = next;
    return true;
  }

  layer = await openVideoLayer().catch(() => null);
  const booted = (await fetchCurrent()) ?? FALLBACK_POINTER;
  await mountStudy(booted);

  // Pointer watcher: hot-swap on study change; forward same-study pointer
  // moves to the live study so the intervention layer can rasterize the cut.
  watchCurrent(booted, async (next, previous) => {
    if (study && next.study === previous.study) {
      // same study: hand the pointer to the intervention layer (visible cut)
      // without remounting anything
      study.onPointer?.(next);
      void sketchEvents
        .emitInfo("gallery", "gallery.pointer.moved", {
          from: `${previous.study}@${previous.sha.slice(0, 7)}`,
          to: `${next.study}@${next.sha.slice(0, 7)}`,
        })
        .catch(() => undefined);
      return;
    }
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
    study?.onResize?.(window.innerWidth, window.innerHeight);
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
          poll: POLL_INTERVAL_MS,
        })
        .catch(() => {
          // telemetry must never break the sketch
        });
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
    overlay.textContent = `renderer failed: ${initError instanceof Error ? initError.message : "unknown"}`;
  }
}
