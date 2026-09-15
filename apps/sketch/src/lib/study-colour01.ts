/**
 * Study: colour-01 — the delay becomes chroma.
 *
 * Branches withhold-01.3 (9cb8ac9): the same room, the same seeked one-shot
 * arrival, the same material (conquerb1943.mp4) — but the delay lineage is
 * rendered as COLOUR (art-direction.svx lane 1: Lis Rhodes, Light Music,
 * 1975). The screen is one TSL node material sampling three channel rings
 * with per-channel delays (R=0s live, G=1.5s late, B=3.0s later): still
 * regions collapse to monochrome, motion fringes into primaries. The
 * projector's coloured point lights carry the palette into the room,
 * amber fog gives every beam a body, and a displaced floor grid catches
 * the coloured light with real falloff.
 *
 * Palette: R 0xff2a1a / G 0x2bff6a / B 0x2a6aff + room amber 0xffa02a
 * (Lis Rhodes, Light Music, 1975).
 */

import * as THREE from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { texture, vec3, uv } from "three/tsl";
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

// the operation: per-channel temporal delays in frames at ~30fps
const D_R = 0; // live
const D_G = 45; // 1.5s
const D_B = 90; // 3.0s
const RING_G = D_G + 1; // ring lengths, clock-02 grammar
const RING_B = D_B + 1;
const RT_W = 480;
const RT_H = 270;

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
  videoCamera: THREE.OrthographicCamera;
  videoQuad: THREE.Mesh;
  ringG: THREE.RenderTarget[];
  ringB: THREE.RenderTarget[];
  frame: { value: number };
  ringIdx: { g: number; b: number };
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

let ringCache: { g: THREE.RenderTarget[]; b: THREE.RenderTarget[] } | null = null;

function makeRings(): { g: THREE.RenderTarget[]; b: THREE.RenderTarget[] } {
  if (ringCache) return ringCache;
  ringCache = { g: [], b: [] };
  for (let i = 0; i < RING_G; i++) {
    const t = new THREE.RenderTarget(RT_W, RT_H, { depthBuffer: false });
    t.texture.colorSpace = THREE.SRGBColorSpace;
    ringCache.g.push(t);
    if (i < RING_B) {
      const tb = new THREE.RenderTarget(RT_W, RT_H, { depthBuffer: false });
      tb.texture.colorSpace = THREE.SRGBColorSpace;
      ringCache.b.push(tb);
    }
  }
  return ringCache;
}

// THE OPERATION, in one TSL node material: the same picture three times at
// three moments, each sample contributing ONLY its own channel.
function makeSplitMaterial(
  videoTexture: THREE.Texture,
  gTex: THREE.Texture,
  bTex: THREE.Texture,
): MeshBasicNodeMaterial {
  const mat = new MeshBasicNodeMaterial();
  const tR = texture(videoTexture, uv());
  const tG = texture(gTex, uv());
  const tB = texture(bTex, uv());
  mat.colorNode = vec3(tR.r, tG.g, tB.b);
  mat.color.setScalar(1);
  return mat;
}

function buildScene(videoTexture: THREE.VideoTexture): Colour01Scene {
  const scene = new THREE.Scene();
  // amber fog WITH A BODY: beams are volumes, walls appear where light reaches
  scene.fog = new THREE.FogExp2(0x150a02, 0.05);
  scene.background = new THREE.Color(0x030204);

  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.4, 0.85, 5.9); // withhold-01 opening rail
  camera.lookAt(-0.5, 1.1, 0);

  // hidden capture rig: the raw video alone, flat, into the channel rings
  const videoCamera = new THREE.OrthographicCamera(-0.5, 0.5, 0.5, -0.5, 0.01, 10);
  videoCamera.position.set(0, 0, 1);
  videoCamera.lookAt(0, 0, 0);
  const videoQuad = new THREE.Mesh(
    new THREE.PlaneGeometry(1, 1),
    new THREE.MeshBasicMaterial({ map: videoTexture, color: 0xffffff }),
  );
  videoQuad.visible = false; // rendered only into the capture targets
  scene.add(videoQuad);

  const rings = makeRings();

  // the curved screen; split material assigned when rings are warm
  const screenGeo = new THREE.CylinderGeometry(
    SCREEN_R, SCREEN_R, SCREEN_H, 48, 1, true, -SCREEN_ARC / 2, SCREEN_ARC,
  );
  const screenMat = new MeshBasicNodeMaterial();
  screenMat.colorNode = vec3(0.02, 0.02, 0.03); // closed plate until split
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, SCREEN_H / 2 - 0.1, -2.2);
  screen.rotation.y = Math.PI;
  scene.add(screen);

  // displaced floor: relief catches the coloured light with real falloff
  const floorGeo = new THREE.PlaneGeometry(30, 22, 120, 90);
  {
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
  }
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
  const gLight = new THREE.PointLight(COL_G, 30, 26, 1.5);
  gLight.position.set(PROJ.x + 0.5, PROJ.y + 0.15, PROJ.z);
  scene.add(gLight);
  const bLight = new THREE.PointLight(COL_B, 22, 26, 1.6);
  bLight.position.set(PROJ.x + 1.0, PROJ.y - 0.1, PROJ.z);
  scene.add(bLight);
  const rLight = new THREE.PointLight(COL_R, 18, 22, 1.7);
  rLight.position.set(PROJ.x - 0.4, PROJ.y - 0.5, PROJ.z);
  scene.add(rLight);
  const spill = new THREE.PointLight(COL_AMBER, 7, 24, 1.9);
  spill.position.set(1.2, 3.0, 1.2);
  scene.add(spill);

  // three channel beam cones, each swaying on its own
  const beamCones: THREE.Mesh[] = [];
  const coneCols = [COL_R, COL_G, COL_B];
  for (let ci = 0; ci < 3; ci++) {
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 1.7, 1, 24, 1, true),
      new THREE.MeshBasicMaterial({
        color: coneCols[ci] ?? 0xffffff,
        transparent: true,
        opacity: 0.07,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    cone.userData = { ci };
    scene.add(cone);
    beamCones.push(cone);
  }

  // the projector body
  const proj = new THREE.Mesh(
    new THREE.CylinderGeometry(0.3, 0.38, 0.6, 10),
    new THREE.MeshStandardMaterial({ color: 0x16161c, metalness: 0.5, roughness: 0.3 }),
  );
  proj.rotation.z = Math.PI / 2 - 0.45;
  proj.position.copy(PROJ);
  scene.add(proj);

  return {
    scene, camera, videoCamera, videoQuad,
    ringG: rings.g, ringB: rings.b,
    frame: { value: 0 },
    ringIdx: { g: 0, b: 0 },
    screen, canvasFloor, proj,
    lights: { r: rLight, g: gLight, b: bLight, spill },
    beamCones,
  };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<Colour01Runtime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene(videoLayer.texture);
    const screenMat = study.screen.material as MeshBasicNodeMaterial;

    const unwrapRepeat = (tex: THREE.Texture): void => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1; // cylinder inner face reads mirrored otherwise
    };
    unwrapRepeat(videoLayer.texture);

    void sketchEvents
      .emitInfo("study", "study.ready", { study: STUDY, channelDelays: { r: 0, g: 1.5, b: 3.0 } })
      .catch(() => undefined);

    // the split material goes live after RING_B warm frames (the B ring
    // needs 91 written slots before its read head holds real past)
    const WARM = RING_B;
    let warm = 0;
    const CPU_FPS = 30; // ring advance pace (~61 fps display, ~30 capture)
    let lastCapture = 0;
    let splitLive = false;

    let lastPointerKey = "";
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
      step(r, now, deltaMs) {
        void deltaMs;
        const n = study.frame.value;

        // capture the video into both rings at ~30fps
        if (now - lastCapture >= 1000 / CPU_FPS) {
          lastCapture = now;
          study.ringIdx.g = (study.ringIdx.g + 1) % RING_G;
          study.ringIdx.b = (study.ringIdx.b + 1) % RING_B;
          const wg = study.ringG[study.ringIdx.g]!;
          const wb = study.ringB[study.ringIdx.b]!;
          study.videoQuad.visible = true;
          (study.videoQuad.material as THREE.MeshBasicMaterial).map = videoLayer.texture;
          r.setRenderTarget(wg);
          r.render(study.scene, study.videoCamera);
          r.setRenderTarget(wb);
          r.render(study.scene, study.videoCamera);
          r.setRenderTarget(null);
          study.videoQuad.visible = false;
          warm++;
          if (!splitLive && warm >= WARM) {
            // read heads: G = 45 slots behind write, B = 90 behind
            const gTex = study.ringG[(study.ringIdx.g + 1) % RING_G]!.texture;
            const bTex = study.ringB[(study.ringIdx.b + 1) % RING_B]!.texture;
            const split = makeSplitMaterial(videoLayer.texture, gTex, bTex);
            screenMat.colorNode = split.colorNode;
            screenMat.needsUpdate = true;
            splitLive = true;
            void sketchEvents
              .emitInfo("study", "colour01.splitLive", { afterFrames: warm, rt: `${RT_W}x${RT_H}` })
              .catch(() => undefined);
          }
        }

        r.render(study.scene, study.camera);
        study.frame.value = n + 1;
      },
      onResize(w: number, h: number) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
      },
      dispose() {
        for (const t of study.ringG) t.dispose();
        for (const t of study.ringB) t.dispose();
        ringCache = null;
        study.videoQuad.geometry.dispose();
        (study.videoQuad.material as THREE.Material).dispose();
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
