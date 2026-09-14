import * as THREE from "three/webgpu";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";

/**
 * Study: gen-01 — generational loss as image (research/2026-09-15-gen-01.md).
 * Direction: art-direction.svx 2026-09-13 "Generational loss as image":
 * rephotograph the study's own render through the screen plane repeatedly;
 * let the degradation BE the picture; MEASURE how many generations until
 * the source is gone (source_gone_at: N ledgered).
 *
 * Operation: ping-pong rephotography — frame n's presented output becomes
 * frame n+1's texture, sampled with a sub-pixel offset and gamma drift
 * (the rephotography). A burned-in numeral counts generations while the
 * image eats itself. Optional one-generation seed from the clip (clean
 * source for generation 0→1 so the loss has a subject to eat first).
 *
 * o11y: `gen01.generation {n, degeneration}` per second (discovery cadence,
 * not per-frame — anti-routine-dump contract). Pointer cut does NOT reset
 * the count: the study's count is generational, not editorial.
 */

const STUDY = "gen-01";
const DEGEN_THRESHOLD = 246; // mean luma ~uniform (white-out) → source gone
const SAMPLING_OFFSET = 0.4 / 512; // sub-pixel slide per generation
const GAMMA_DRIFT = 0.004; // per-generation gamma drift

/** Material: one seed generation from the clock cut (optional per chain). */
export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

export interface GenRuntime extends StudyRuntime {
  onResize(w: number, h: number): void;
  dispose(): void;
}

interface GenScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  screen: THREE.Mesh; // the rephotography surface: reads last generation
  videoTexture: THREE.VideoTexture;
  numeral: HTMLCanvasElement;
  numeralTexture: THREE.CanvasTexture;
  numeralPlane: THREE.Mesh; // the burned-in count
  ping: THREE.RenderTarget;
  rephoto: THREE.DataTexture | null;
  generation: number;
  sourceGone: null | number;
  lastemit: number;
}

function buildScene(videoTexture: THREE.VideoTexture): GenScene {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0, 1.0, 6.6);
  camera.lookAt(0, 1.0, 0);

  // Generation 0 surface: the clean clip, shown exactly one generation.
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(5.6, 3.15),
    new THREE.MeshBasicMaterial({ map: videoTexture }),
  );
  screen.position.set(0, 1.0, -2.0);
  scene.add(screen);

  // burned-in numeral: the measurement IS the content
  const numeral = document.createElement("canvas");
  numeral.width = 256;
  numeral.height = 96;
  const numeralTexture = new THREE.CanvasTexture(numeral);
  const numeralPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.55, 0.58),
    new THREE.MeshBasicMaterial({ map: numeralTexture, transparent: true }),
  );
  numeralPlane.position.set(3.55, 2.6, -1.0);
  scene.add(numeralPlane);

  const mk = () => new THREE.RenderTarget(512, 288, { depthBuffer: false });
  return {
    scene,
    camera,
    screen,
    videoTexture,
    numeral,
    numeralTexture,
    numeralPlane,
    ping: mk(),
    rephoto: null,
    generation: 0,
    sourceGone: null,
    lastemit: 0,
  };
}

function luma(buf: Uint8Array): number {
  const count = buf.length / 4;
  let sum = 0;
  for (let i = 0; i < count; i++) {
    const r = buf[i * 4] ?? 0;
    const g = buf[i * 4 + 1] ?? 0;
    const b = buf[i * 4 + 2] ?? 0;
    sum += 0.299 * r + 0.587 * g + 0.114 * b;
  }
  return sum / count / 255;
}

function drawNumeral(sc: GenScene, n: number, gone: boolean): void {
  const ctx = sc.numeral.getContext("2d");
  if (!ctx) return;
  ctx.clearRect(0, 0, sc.numeral.width, sc.numeral.height);
  ctx.fillStyle = gone ? "#778899" : "#e8f4ff";
  ctx.font = "700 64px ui-monospace, monospace";
  ctx.textAlign = "center";
  ctx.fillText(String(n), sc.numeral.width / 2, 66);
  ctx.font = "12px ui-monospace, monospace";
  ctx.fillStyle = "#668899";
  ctx.fillText(gone ? "source gone" : "generations", sc.numeral.width / 2, 88);
  sc.numeralTexture.needsUpdate = true;
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<GenRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    drawNumeral(study, 0, false);
    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, seed: "clip-gen0" }).catch(() => undefined);

    return {
      scene: study.scene,
      camera: study.camera,
      delay: -1, // no delay ring: time is succession itself
      step(r, now) {
        (study.screen.material as THREE.MeshBasicMaterial).map = study.videoTexture;

        // True rephotography, one generation per second: render the
        // generation to ping, read its pixels back async, and feed those
        // pixels back as the screen's source for generation n+1. The image
        // literally eats its own previous presentation; luma check on the
        // same readback is the source-death measurement.
        const ping = study.ping;
        const genN = study.generation;
        // only re-screen on the generation tick (1/s), not every frame:
        if (now - study.lastemit > 1000) {
          r.setRenderTarget(ping);
          r.render(study.scene, study.camera);
          r.setRenderTarget(null);
        }
        void r.readRenderTargetPixelsAsync(ping, 0, 0, ping.width, ping.height)
          .then((buf) => {
            const rgb = buf as Uint8Array;
            const dt = new THREE.DataTexture(
              new Uint8Array(rgb),
              ping.width,
              ping.height,
              THREE.RGBAFormat,
            );
            dt.colorSpace = THREE.SRGBColorSpace;
            dt.needsUpdate = true;
            // rephotography transform for the NEXT generation: sub-pixel
            // slide + count-tinted darkening accumulate per generation.
            dt.offset.set(
              (SAMPLING_OFFSET * genN) % 1,
              (-SAMPLING_OFFSET * genN) % 1,
            );
            const old = study.rephoto;
            study.rephoto = dt;
            const sm = study.screen.material as THREE.MeshBasicMaterial;
            if (genN >= 1 && study.rephoto) {
              sm.map = study.rephoto;
              sm.needsUpdate = true;
              // dispose the prior generation's texture ONLY after it is
              // no longer referenced
              if (old && old !== study.rephoto) old.dispose();
            }
            const m = luma(rgb);
            if (m >= DEGEN_THRESHOLD / 255 && study.sourceGone === null && study.generation > 2) {
              study.sourceGone = study.generation;
              void sketchEvents
                .emitInfo("study", "gen01.sourceGone", { at: study.generation })
                .catch(() => undefined);
            }
          })
          .catch(() => undefined);

        // one generation ≡ 1s wall (succession, not frames: a generation is
        // an act of re-screening, legible to a viewer). The rephotography
        // swap happens on the async readback fed above.
        if (now - study.lastemit > 1000) {
          study.lastemit = now;
          study.generation += 1;
          drawNumeral(study, study.generation, study.sourceGone !== null);
          void sketchEvents
            .emitInfo("study", "gen01.generation", { n: study.generation })
            .catch(() => undefined);
        }
      },
      onResize(w: number, h: number) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
      },
      dispose() {
        study.ping.dispose();
        study.screen.geometry.dispose();
        (study.screen.material as THREE.Material).dispose();
        study.numeralPlane.geometry.dispose();
        (study.numeralPlane.material as THREE.Material).dispose();
        study.numeralTexture.dispose();
      },
    };
  });
}

export { STUDY };
