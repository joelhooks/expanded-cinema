/**
 * Study: colour-01 — the delay becomes chroma.
 *
 * Branches withhold-01.3: same room, same seeked one-shot arrival, same
 * material (conquerb1943.mp4) — but the delay lineage is rendered as
 * COLOUR (art-direction.svx lane 1: Lis Rhodes, Light Music, 1975).
 * The screen is ONE TSL node material sampling the same picture at three
 * moments, each sample contributing only its own channel:
 *   R = live (0s), G = 1.5s late, B = 3.0s later.
 * Still regions collapse to monochrome; motion fringes into primaries.
 *
 * Temporal mechanism: two hidden muted video elements playing the SAME
 * file, drift-locked to the main layer at -1.5s and -3.0s (hard seek when
 * the drift exceeds 0.12s). Three browser decoders ARE the delay line.
 *
 * Palette: R 0xff2a1a / G 0x2bff6a / B 0x2a6aff + room amber 0xffa02a.
 * Coloured point lights carry the palette into the room, amber fog gives
 * every beam a body, and a displaced floor grid catches the light.
 */

import * as THREE from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { texture, vec2, vec3, uv } from "three/tsl";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

const STUDY = "colour-01";

export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b96bfb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

// geometry constants carried from withhold-01 (proven room)
const PROJ = new THREE.Vector3(-3.9, 1.35, 2.4);
const SCREEN_R = 3.4;
const SCREEN_ARC = Math.PI * 0.62;
const SCREEN_H = 3.3;
const LAND = new THREE.Vector3(0.0, 1.6, -2.2); // beam lands centre of screen

// the operation: per-channel temporal delays (seconds)
const D_R = 0;
const D_G = 1.5;
const D_B = 3.0;
const MAIN_SRC = "/videos/conquerb1943.mp4";
const MAIN_DUR = 90.02;
const DRIFT_LIMIT = 0.12;

// palette
const COL_R = 0xff2a1a;
const COL_G = 0x2bff6a;
const COL_B = 0x2a6aff;
const COL_AMBER = 0xffa02a;

export interface Colour01Runtime extends StudyRuntime {
  onPointer?(p: CurrentStudy): void;
}

interface Colour01Scene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  screen: THREE.Mesh;
  canvasFloor: THREE.Mesh;
  proj: THREE.Mesh;
  lights: {
    r: THREE.PointLight;
    g: THREE.PointLight;
    b: THREE.PointLight;
    spill: THREE.PointLight;
  };
  beamCones: THREE.Mesh[];
}

// THE OPERATION, one TSL node material: same picture at three moments,
// each sample contributing only its own channel.
function makeSplitColorNode(
  texR: THREE.Texture,
  texG: THREE.Texture,
  texB: THREE.Texture,
): unknown {
  // cylinder inner face reads mirrored otherwise: mirror inside the node
  const uvm = vec2(uv().x.mul(-1).add(1), uv().y);
  const tR = texture(texR, uvm);
  const tG = texture(texG, uvm);
  const tB = texture(texB, uvm);
  // 0.4% luminance floor: a black film frame keeps the plate faintly
  // readable so "dark surface" can never read as "missing surface"
  return vec3(tR.r, tG.g, tB.b).add(vec3(0.01, 0.006, 0.004));
}

// PROBE 2 (AD seq-45): a pure procedural gradientノ — no textures. If the
// plate shows red->green horizontally, material+geometry are fine and any
// black is a texture-sampling problem, not a material problem.
function probeGradient(): unknown {
  return vec3(uv().x.mul(2).add(0.15), uv().y.mul(1.2).add(0.05), 0.25);
}

function buildScene(): Colour01Scene {
  const scene = new THREE.Scene();
  // PROBE: fog disabled - FogExp2 + MeshBasicNodeMaterial colorNode is the
  // last suspect for the black-plate fallback (AD seq-45 isolation)
  const fogWanted = false;
  if (fogWanted) scene.fog = new THREE.FogExp2(0x150a02, 0.045);
  scene.background = new THREE.Color(0x030204);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.4, 0.85, 5.9); // withhold-01 opening rail
  camera.lookAt(-0.5, 1.1, 0);

  const screenGeo = new THREE.CylinderGeometry(
    SCREEN_R, SCREEN_R, SCREEN_H, 48, 1, true, -SCREEN_ARC / 2, SCREEN_ARC,
  );
  const screenMat = new MeshBasicNodeMaterial();
  screenMat.colorNode = vec3(1.4, 0.35, 0.1); // amber plate, frame-filling
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, SCREEN_H / 2 - 0.1, -2.2);
  screen.rotation.y = Math.PI;
  scene.add(screen);

  // displaced floor: relief catches the coloured light with real falloff
  const floorGeo = new THREE.PlaneGeometry(30, 22, 120, 90);
  const pos = floorGeo.attributes.position as THREE.BufferAttribute;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i) ?? 0;
    const y = pos.getY(i) ?? 0;
    pos.setZ(
      i,
      Math.sin(x * 0.8) * 0.06 + Math.cos(y * 1.1) * 0.05 + Math.sin(x * 2.3 + y * 1.7) * 0.02,
    );
  }
  pos.needsUpdate = true;
  floorGeo.computeVertexNormals();
  const canvasFloor = new THREE.Mesh(
    floorGeo,
    new THREE.MeshStandardMaterial({ color: 0x2a1e12, roughness: 0.85, metalness: 0.1 }),
  );
  canvasFloor.rotation.x = -Math.PI / 2;
  canvasFloor.position.set(0, -0.05, -2);
  scene.add(canvasFloor);

  // walls: dark receivers (the light paints them)
  const roomMat = new THREE.MeshLambertMaterial({ color: 0x1a1108 });
  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 9), roomMat);
  back.position.set(0, 4, -7.6);
  back.rotation.y = Math.PI;
  scene.add(back);
  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), roomMat);
  sideL.position.set(-10.3, 4, -2);
  sideL.rotation.y = Math.PI / 2;
  scene.add(sideL);
  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), roomMat);
  sideR.position.set(10.3, 4, -2);
  sideR.rotation.y = -Math.PI / 2;
  scene.add(sideR);

  // point lights: each channel colour, plus the amber room spill
  scene.add(new THREE.AmbientLight(0x140d06, 0.4));
  const gLight = new THREE.PointLight(COL_G, 60, 30, 1.4);
  gLight.position.set(PROJ.x + 0.5, PROJ.y + 0.15, PROJ.z);
  scene.add(gLight);
  const bLight = new THREE.PointLight(COL_B, 45, 30, 1.5);
  bLight.position.set(PROJ.x + 1.0, PROJ.y - 0.1, PROJ.z);
  scene.add(bLight);
  const rLight = new THREE.PointLight(COL_R, 35, 24, 1.6);
  rLight.position.set(PROJ.x - 0.4, PROJ.y - 0.5, PROJ.z);
  scene.add(rLight);
  const spill = new THREE.PointLight(COL_AMBER, 14, 26, 1.8);
  spill.position.set(1.2, 3.0, 1.2);
  scene.add(spill);

  // three channel beam CONES: from the projector lens to the screen,
  // sized like the withhold-01 beam (throw 3.1, opening radius ~1.9)
  const beamCones: THREE.Mesh[] = [];
  const coneCols = [COL_R, COL_G, COL_B];
  const throwVec = LAND.clone().sub(PROJ);
  const throwLen = throwVec.length();
  for (let ci = 0; ci < 3; ci++) {
    const spread = 0.9 + ci * 0.45;
    // wide end at the screen: throwVec maps +Y toward the landing point
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(spread, 0.06, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: coneCols[ci] ?? 0xffffff,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
        fog: false,
      }),
    );
    // unit cylinder is Y-up centred: scale Z to throw, aim at the landing
    cone.scale.set(1, throwLen, 1);
    cone.position.copy(PROJ).addScaledVector(throwVec, 0.5);
    cone.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      throwVec.clone().normalize(),
    );
    cone.userData = { ci };
    scene.add(cone);
    beamCones.push(cone);
  }

  const proj = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.38, 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.5, roughness: 0.3 }),
  );
  proj.rotation.z = Math.PI / 2 - 0.45;
  proj.position.copy(PROJ);
  scene.add(proj);

  return {
    scene, camera, screen, canvasFloor, proj,
    lights: { r: rLight, g: gLight, b: bLight, spill },
    beamCones,
  };
}

// the delay line: two extra muted decoders locked to the main element
interface DelayVideo {
  video: HTMLVideoElement;
  texture: THREE.VideoTexture;
}

function makeDelayVideo(src: string): DelayVideo {
  const video = document.createElement("video");
  video.src = src;
  video.muted = true;
  video.loop = true;
  video.playsInline = true;
  video.style.display = "none";
  document.body.appendChild(video);
  const texture = new THREE.VideoTexture(video);
  texture.colorSpace = THREE.SRGBColorSpace;
  return { video, texture };
}

function driftCorrect(main: HTMLVideoElement, v: HTMLVideoElement, delay: number): void {
  if (v.readyState < 1 || main.currentTime < delay + 0.1) return;
  const want = (main.currentTime - delay + MAIN_DUR) % MAIN_DUR;
  let d = v.currentTime - want;
  if (Math.abs(d) > MAIN_DUR / 2) d -= Math.sign(d) * MAIN_DUR; // loop wrap
  if (Math.abs(d) > DRIFT_LIMIT) v.currentTime = want;
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<Colour01Runtime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene();
    const screenMat = study.screen.material as MeshBasicNodeMaterial;

    // mirroring lives inside the split node's UV; no repeat tricks
    screenMat.map = null;
    screenMat.color = new THREE.Color(0xffffff);

    const mainVideo = (): HTMLVideoElement | null =>
      (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image ?? null;

    // the delay line: two extra decoders on the same file
    const delayed = { g: makeDelayVideo(MAIN_SRC), b: makeDelayVideo(MAIN_SRC) };
    let decodersLive = false;

    void sketchEvents
      .emitInfo("study", "study.ready", { study: STUDY, channelDelays: { r: D_R, g: D_G, b: D_B } })
      .catch(() => undefined);

    let lastPointerKey = "";
    let splitLive = false; // true = delayed channels live
    let baseLive = false; // true = node material live, delays all 0
    let driftLogTick = 0;
    let driftAccum = { g: 0, b: 0 };
    let placementLogged = false;
    const logPlacement = (): void => {
      if (placementLogged) return;
      placementLogged = true;
      const plate = study.screen;
      plate.updateWorldMatrix(true, false);
      const box = new THREE.Box3().setFromObject(plate);
      const cam = study.camera;
      const frustum = new THREE.Frustum();
      frustum.setFromProjectionMatrix(
        new THREE.Matrix4().multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse),
      );
      void sketchEvents
        .emitInfo("study", "colour01.placement", {
          platePos: [plate.position.x, plate.position.y, plate.position.z],
          plateBoxMin: [box.min.x, box.min.y, box.min.z].map((v) => Number(v.toFixed(2))),
          plateBoxMax: [box.max.x, box.max.y, box.max.z].map((v) => Number(v.toFixed(2))),
          lens: [PROJ.x, PROJ.y, PROJ.z],
          cam: [cam.position.x, cam.position.y, cam.position.z],
          inFrustum: frustum.intersectsObject(plate),
          materialType: (plate.material as THREE.Material).type,
          colorNodeSet: Boolean((plate.material as MeshBasicNodeMaterial).colorNode),
        })
        .catch(() => undefined);
    };

    const handledError = (msg: string, err: unknown): void => {
      void sketchEvents
        .emitInfo("study", "colour01.error", { msg, err: String(err).slice(0, 140) })
        .catch(() => undefined);
    };

    return {
      scene: study.scene,
      camera: study.camera,
      delay: D_B,
      onPointer(p) {
        const key = `${p.study}@${p.sha}@${p.updatedAt}`;
        if (key === lastPointerKey) return;
        lastPointerKey = key;
        void sketchEvents
          .emitInfo("study", "colour01.intervention", { sha: p.sha.slice(0, 16) })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        void delta;
        const main = mainVideo();
        if (
          main && main.readyState >= 2 && main.currentTime > 0.15
          && main.currentTime < MAIN_DUR - 0.5
        ) {
          try {
            if (!decodersLive) {
              void delayed.g.video.play().catch(() => handledError("playG", "rejected"));
              void delayed.b.video.play().catch(() => handledError("playB", "rejected"));
              decodersLive = true;
            }
            if (!baseLive) {
              // AD seq-45 PROBE: procedural gradient first — proves the
              // node material is on the mesh before any texture is trusted
              screenMat.colorNode = probeGradient() as typeof screenMat.colorNode;
              screenMat.needsUpdate = true;
              baseLive = true;
              void sketchEvents
                .emitInfo("study", "colour01.baseLive", { mainT: Number(main.currentTime.toFixed(2)) })
                .catch(() => undefined);
            }
            driftCorrect(main, delayed.g.video, D_G);
            driftCorrect(main, delayed.b.video, D_B);
            const gReady = delayed.g.video.readyState >= 2;
            const bReady = delayed.b.video.readyState >= 2;
            if (!splitLive && gReady && bReady && delayed.b.video.currentTime > D_B + 0.3) {
              const dg = Math.abs(delayed.g.video.currentTime - (main.currentTime - D_G));
              const db = Math.abs(delayed.b.video.currentTime - (main.currentTime - D_B));
              driftAccum.g = driftAccum.g * 0.9 + Math.min(dg, MAIN_DUR - dg) * 0.1;
              driftAccum.b = driftAccum.b * 0.9 + Math.min(db, MAIN_DUR - db) * 0.1;
              // delays go live only when BOTH decoders are locked (0.05s EMA)
              if (driftAccum.g < 0.05 && driftAccum.b < 0.05) {
                screenMat.colorNode = makeSplitColorNode(
                  videoLayer.texture, delayed.g.texture, delayed.b.texture,
                ) as typeof screenMat.colorNode;
                screenMat.needsUpdate = true;
                splitLive = true;
                void sketchEvents
                  .emitInfo("study", "colour01.splitLive", {
                    mainT: Number(main.currentTime.toFixed(2)),
                    gT: Number(delayed.g.video.currentTime.toFixed(2)),
                    bT: Number(delayed.b.video.currentTime.toFixed(2)),
                    driftEMA: [Number(driftAccum.g.toFixed(3)), Number(driftAccum.b.toFixed(3))],
                  })
                  .catch(() => undefined);
              }
            }
            driftLogTick++;
            if (driftLogTick % 120 === 1) {
              void sketchEvents
                .emitInfo("study", "colour01.drift", {
                  main: Number(main.currentTime.toFixed(2)),
                  g: Number(delayed.g.video.currentTime.toFixed(2)),
                  b: Number(delayed.b.video.currentTime.toFixed(2)),
                  split: splitLive,
                  base: baseLive,
                })
                .catch(() => undefined);
            }
          } catch (err) {
            handledError("step", err);
          }
        }

        // the light itself moves: cones sway, colours breathe against each
        const t = now / 1000;
        for (const cone of study.beamCones) {
          const ci = (cone.userData as { ci: number }).ci ?? 0;
          cone.rotation.z = Math.sin(t * (0.9 + ci * 0.5) + ci * 2.1) * 0.12;
          const mat = cone.material as THREE.MeshBasicMaterial;
          mat.opacity = 0.10 + 0.10 * (0.5 + 0.5 * Math.sin(t * (1.1 + ci * 0.4) + ci));
        }
        const breath = 0.75 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2.2));
        study.lights.r.intensity = 55 * (1.6 - breath);
        study.lights.g.intensity = 80 * breath;
        study.lights.b.intensity = 55 * (1.6 - breath);
        const cutPulse = Math.pow(Math.max(0, Math.sin(t * 0.9)), 24);
        study.lights.spill.intensity = 10 + 26 * cutPulse;

        r.render(study.scene, study.camera);
        logPlacement();
      },
      onResize(w: number, h: number) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
      },
      dispose() {
        delayed.g.video.pause();
        delayed.b.video.pause();
        delayed.g.video.remove();
        delayed.b.video.remove();
        delayed.g.texture.dispose();
        delayed.b.texture.dispose();
        study.screen.geometry.dispose();
        (study.screen.material as THREE.Material).dispose();
        study.canvasFloor.geometry.dispose();
        (study.canvasFloor.material as THREE.Material).dispose();
        study.proj.geometry.dispose();
        (study.proj.material as THREE.Material).dispose();
        for (const c of study.beamCones) {
          c.geometry.dispose();
          (c.material as THREE.Material).dispose();
        }
      },
    };
  });
}

export { D_B, D_G, D_R, STUDY };
