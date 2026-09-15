import * as THREE from "three/webgpu";
import { useVideoLayerState } from "../state/videoLayerState";
import { sketchEvents } from "./o11y";

/**
 * Video layer: promotes the catalog's starter clip into the scene as a
 * projected surface. The HTMLVideoElement is authoritative playback state
 * (muted/loop/playinline for autoplay policy), the WebGPU texture reads
 * from it every frame, and every lifecycle hop emits o11y events: load,
 * activation, play success/failure, and error.
 */

export interface VideoLayerHandle {
  /** The texture the scene should map onto projection surfaces. */
  readonly texture: THREE.VideoTexture;
  /** Resolves once the video is actually advancing (timeupdate seen). */
  readonly ready: Promise<boolean>;
  /** Stops playback, removes the element, disposes the texture. Idempotent. */
  dispose(): void;
}

async function waitUntilAdvancing(video: HTMLVideoElement, timeoutMs = 10_000): Promise<boolean> {
  if (video.readyState >= 2) {
    await video.play().catch(() => undefined);
  }
  return new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => resolve(false), timeoutMs);
    video.addEventListener(
      "timeupdate",
      () => {
        window.clearTimeout(timer);
        resolve(true);
      },
      { once: true },
    );
  });
}

export async function openVideoLayer(
  source?: { src: string; hash: string },
): Promise<VideoLayerHandle | null> {
  useVideoLayerState.getState().start();

  const video = document.createElement("video");
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.crossOrigin = "anonymous";
  video.style.display = "none";
  document.body.appendChild(video);

  const { activate, ready } = useVideoLayerState.getState();
  const starterSrc = source?.src ?? "/videos/starter.mp4";
  const starterHash =
    source?.hash ??
    "1f0e3a5c2b98e7a1156c4d2f9b7a4c0e8d3f6b2a9c5e1d740f83b6a29ec51d74";
  activate(starterSrc, starterHash);
  video.src = starterSrc;
  video.load();
  ready();

  const src = useVideoLayerState.getState().currentSrc ?? "";

  const [advancing, loadError] = await sketchEvents.measured(
    "video-layer",
    "video.load",
    { src },
    async () => {
      // wait for canplay, then for visible advancement (autoplay policy proof)
      await new Promise<void>((resolve, reject) => {
        video.addEventListener("canplay", () => resolve(), { once: true });
        video.addEventListener("error", () => reject(new Error(`video ${src} failed to load`)), { once: true });
      }).catch((caught: unknown) => {
        throw caught;
      });
      const advances = await waitUntilAdvancing(video);
      if (!advances) {
        throw new Error("video loaded but does not advance (autoplay blocked?)");
      }
      return true as boolean;
    },
  ).then(
    (r: boolean) => [r, null] as const,
    (caught: unknown) =>
      [
        false,
        caught instanceof Error ? caught.message : String(caught),
      ] as const,
  );

  if (!advancing) {
    await sketchEvents.emitFailure("video-layer", "video.load", loadError ?? "unknown video load failure", { src });
    // The knot hello world remains; the video layer failure is reported, never silent.
    return null;
  }

  sketchEvents.emitInfo("video-layer", "video.activate", { src, advancing }).catch(() => undefined);

  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;

  video.addEventListener("error", () => {
    sketchEvents
      .emitFailure("video-layer", "video.error", `runtime video error on ${src}`, { src })
      .catch(() => undefined);
  });

  return {
    texture,
    ready: Promise.resolve(true),
    dispose() {
      video.pause();
      video.removeAttribute("src");
      video.load();
      video.remove();
      texture.dispose();
    },
  };
}
