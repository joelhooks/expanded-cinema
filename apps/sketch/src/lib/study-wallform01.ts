import * as THREE from "three/webgpu";
import { MeshBasicNodeMaterial } from "three/webgpu";
import { mix, saturate, texture, uv, vec2, vec3 } from "three/tsl";
import { CutDetector, ringLength } from "@expanded-cinema/core";
import { sketchEvents } from "./o11y";
import type { StudyRuntime } from "./study-recurrence";
import type { CurrentStudy } from "./gallery-store";

/**
 * Study: colour-01 (verbatim copy of withhold-01's proven scene; the
 * ONE changed thing per AD seq-47: the plate's material carries a
 * gradient colorNode — base case before any texture is trusted). — the image withholds itself. Branches clock-04 v18
 * (research/2026-09-14-withhold-01.md; the queued dream-monitor provocation
 * on .brain/resources/art-direction.svx). The readiness boundary is the
 * SOLE operation: the surface starts as an authored, unlit absence — a
 * closed aperture plate with an unlit iris ring — never a spinner; the
 * one-shot `seeked` reveal is the shutter (a cut, not a fade); the
 * DELAY-late beam carries the same arrival across the room a few seconds
 * later. Per the v21 lesson the luma-sampled cone detail is DELETED: the
 * beam carries a plain band mean. One source, one surface, one operation,
 * one duration.
 */

const STUDY = "wallform-01";
const DELAY = 180;
const RING = ringLength(DELAY); // 181, enforced by the core contract

/** Material this study projects (same cut; catalog sha from apps/sketch/catalog.json). */
export const VIDEO: { src: string; hash: string } | null = {
  src: "/videos/conquerb1943.mp4",
  hash: "02b596fb075d7ee35e44c09d14466b27d6d618d7156c0afd26a7331a09cae056",
};

export interface WithholdRuntime extends StudyRuntime {
  onPointer?(p: CurrentStudy): void;
  onResize(w: number, h: number): void;
  dispose(): void;
}

interface ClockScene {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  pastCamera: THREE.PerspectiveCamera;
  screen: THREE.Mesh;
  iris: THREE.Mesh;
  wallPic: THREE.Mesh;
  shards: THREE.Mesh[];
  snapCtx: CanvasRenderingContext2D;
  snapTex: THREE.CanvasTexture;
  proj1: THREE.Mesh;
  proj2: THREE.Mesh;
  canvases: THREE.Mesh[];
  slats: THREE.Mesh[];
  frame: { value: number };
  // intervention trace wall-clock
  traceAt: number | null;
  computeBandsFromVideo: (video: HTMLVideoElement) => { bands: Float32Array; luma: Float32Array; bandDetail: Float32Array } | null;
  bandAt: (framesAgo: number) => Float32Array | null;
  detailAt: (framesAgo: number) => Float32Array | null;
  lumaAt: (framesAgo: number) => Float32Array | null;
  pushBandHistory: (bands: Float32Array, detail: Float32Array, luma: Float32Array) => void;
}

/** Beam rig geometry (mirrors clock-02/03's scene scale for archive comparability). */
const LUMA_W = 64;
const LUMA_H = 36;
const SLICES = 120;
const SLICE_H = 2.2;
const BEAM_LEN = 3.1; // projector -> screen throw
const PROJ = new THREE.Vector3(-3.9, 1.35, 2.4);
const PROJ_OFF = new THREE.Vector3(PROJ.x + 1.0, PROJ.y - 0.15, PROJ.z);
const SCREEN_R = 3.4;
const SCREEN_ARC = Math.PI * 0.62; // yaw of the curved screen segment
const SCREEN_H = 3.3;
const SLICE_BAND = Math.floor((LUMA_W * LUMA_H) / SLICES); // luma cells per slice band
const FM_U = 6.4;
const FM_V = 3.6;

function buildScene() {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(0x050409, 0.06);

  // camera lives IN the room, low, slightly off-axis, and drifts on an arc
  const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  camera.position.set(0.4, 0.85, 5.9);
  camera.lookAt(-0.5, 1.1, 0);

  // pastCamera: renders ONLY the luma quads into ring targets (kept from
  // clock-02/03 so same-view capture stays comparable across archives)
  const pastCamera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 100);
  pastCamera.position.set(0.4, 0.85, 5.9);
  pastCamera.lookAt(-0.5, 1.1, 0);

  // room: floor, back wall, curved screen — light receivers, not void
  const roomMat = new THREE.MeshLambertMaterial({ color: 0x1b1626 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 22), roomMat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, -0.02, -2);
  scene.add(floor);

  const back = new THREE.Mesh(new THREE.PlaneGeometry(30, 8), roomMat);
  back.position.set(0, 3.5, -7.6);
  back.rotation.y = Math.PI; // face inward
  scene.add(back);

  const sideL = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), roomMat);
  sideL.position.set(-10.3, 3.5, -2);
  sideL.rotation.y = Math.PI / 2;
  scene.add(sideL);

  const sideR = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), roomMat);
  sideR.position.set(10.3, 3.5, -2);
  sideR.rotation.y = -Math.PI / 2;
  scene.add(sideR);

  // colour-01 palette in the room: channel primaries at the lens, amber
  // spill overhead (Lis Rhodes Light Music 1975 palette, AD seq-42)
  scene.add(new THREE.AmbientLight(0x2a2440, 0.55));
  const spillR = new THREE.PointLight(0xff2a1a, 280, 30, 1.4);
  spillR.position.copy(PROJ);
  scene.add(spillR);
  const spillB = new THREE.PointLight(0x2a6aff, 340, 34, 1.35);
  spillB.position.set(PROJ.x + 1, PROJ.y - 0.2, PROJ.z);
  scene.add(spillB);
  const spillG = new THREE.PointLight(0x2bff6a, 380, 36, 1.3);
  spillG.position.set(PROJ.x + 0.5, PROJ.y + 0.6, PROJ.z - 0.8);
  scene.add(spillG);
  const amber = new THREE.PointLight(0xffa02a, 110, 30, 1.6);
  amber.position.set(1.6, 3.4, 1.4);
  scene.add(amber);
  const spill1 = new THREE.PointLight(0xffe0c0, 2.0, 16, 1.7);
  spill1.position.set(2.0, 2.4, -1.0);
  scene.add(spill1);
  const spill2 = new THREE.PointLight(0x88ccff, 0.8, 16, 1.8);
  spill2.position.set(PROJ.x + 1, PROJ.y - 0.2, PROJ.z);
  scene.add(spill2);

  // the curved screen: open cylinder segment; double-sided so its back edge
  // catches spill and the camera can see it has an outside
  const screenGeo = new THREE.CylinderGeometry(
    SCREEN_R, SCREEN_R, SCREEN_H, 48, 1, true, -SCREEN_ARC / 2, SCREEN_ARC,
  );
  // the film ON the curve: plain UVs initially (seq-21 fix 1)
  // THE ONE CHANGE (AD seq-47): the plate's material is the node material.
  // First state: gradient colorNode (base case). Replaced at shutter time
  // by the RGB time split (base 0/0/0 through the node, then per-channel
  // delays from drift-locked decoders).
  const screenMat = new MeshBasicNodeMaterial() as unknown as THREE.MeshBasicMaterial;
  (screenMat as unknown as { colorNode: unknown }).colorNode = vec3(
    uv().x.mul(2).add(0.15), uv().y.mul(1.2).add(0.05), 0.35,
  );
  screenMat.side = THREE.DoubleSide;
  void screenMat.color;
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.set(0, SCREEN_H / 2 - 0.1, -2.2);
  screen.rotation.y = Math.PI; // concave faces the camera/projector side
  scene.add(screen);

  // wallform-01: the WALL PICTURE leaves the floating card and seats on a
  // FORM (Whitman Shower boundary, AD seq-48/50): a heap of thin shards,
  // one frozen-frame CanvasTexture shared, per-shard UV offsets so the
  // picture is subdivided across the body of the heap.
  const snapCanvas = document.createElement("canvas");
  snapCanvas.width = 256;
  snapCanvas.height = 144;
  const snapCtx = snapCanvas.getContext("2d") as CanvasRenderingContext2D;
  snapCtx.fillStyle = "#05060a";
  snapCtx.fillRect(0, 0, 256, 144);
  const snapTex = new THREE.CanvasTexture(snapCanvas);
  snapTex.colorSpace = THREE.SRGBColorSpace;
  const HEAP_C = new THREE.Vector3(3.6, 1.15, -2.3); // heap base on the floor, right third
  const shards: THREE.Mesh[] = [];
  for (let si = 0; si < 30; si++) {
    const w = 0.6 + Math.random() * 0.7;
    const h = 0.4 + Math.random() * 0.55;
    const d = 0.05 + Math.random() * 0.12;
    const m = new THREE.Mesh(
      new THREE.BoxGeometry(w, h, d),
      (() => {
        const t = snapTex.clone();
        t.needsUpdate = true;
        t.repeat.set(0.22 + Math.random() * 0.13, 0.22 + Math.random() * 0.13);
        t.offset.set(Math.random() * 0.6, Math.random() * 0.6);
        return new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0 });
      })(),
    );
    // rough cone heap
    const a = Math.random() * Math.PI * 2;
    const r = 0.15 + Math.sqrt(Math.random()) * 1.5;
    m.position.set(
      HEAP_C.x + Math.cos(a) * r,
      HEAP_C.y + (1.9 - r) * (0.35 + Math.random() * 0.5),
      HEAP_C.z + Math.sin(a) * r * 0.6,
    );
    m.rotation.set(Math.random() * 0.7 - 0.35, Math.random() * 0.7 - 0.35, Math.random() * 0.7 - 0.35);
    m.userData.uv0 = new THREE.Vector4(
      Math.random() * 0.6,
      Math.random() * 0.6,
      Math.min(1, (w / 6) * 0.4 + 0.2),
      Math.min(1, (h / 3.4) * 0.4 + 0.2),
    );
    scene.add(m);
    shards.push(m);
  }
  // wallPic placeholder keeps downstream references compiling (marked void)
  const wallPic = shards[0]!;


  // withhold-01: the IRIS RING — a thin unlit torus tracing the aperture
  // edge. The closed state reads as an apparatus that has not opened, not
  // as loading. The shutter lights the ring from the projector side.
  const iris = new THREE.Mesh(
    new THREE.TorusGeometry(SCREEN_R * 0.92, 0.035, 8, 64),
    new THREE.MeshBasicMaterial({ color: 0x1a2030, transparent: true, opacity: 0.9 }),
  );
  iris.position.copy(screen.position);
  iris.position.z += 0.05; // just off the plate, camera side
  scene.add(iris);

  // the projector bodies, visible apparatus
  const body = new THREE.CylinderGeometry(0.28, 0.34, 0.55, 10);
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x14161c, metalness: 0.4, roughness: 0.3 });
  const proj1 = new THREE.Mesh(body, bodyMat);
  proj1.rotation.z = Math.PI / 2 - 0.45;
  proj1.position.copy(PROJ);
  scene.add(proj1);
  const proj2 = new THREE.Mesh(body, bodyMat);
  proj2.rotation.z = Math.PI / 2 - 0.45;
  proj2.position.set(PROJ.x + 1.0, PROJ.y - 0.15, PROJ.z);
  scene.add(proj2);

  // afterglow discs at the projector lens (breathing beat)
  const glow = ((): THREE.Mesh => {
    const g = new THREE.Mesh(
      new THREE.CircleGeometry(0.2, 16),
      new THREE.MeshBasicMaterial({ color: 0xbcd4ff, transparent: true, opacity: 0.5 }),
    );
    return g;
  })();
  void glow;
  const canvases: THREE.Mesh[] = [];
  const slats: THREE.Mesh[] = [];

  // beam-01 vertical slats: 16 per beam, each a thin bar across the beam's
  // full height at one arc fraction; samples a luma COLUMN (all rows at
  // that arc u) so vertical detail joins the horizontal band detail.
  const SLATS = 16;
  for (let si = 0; si < SLATS; si++) {
    const uFrac = (si + 0.5) / SLATS;
    for (const beam of [0, 1]) {
      // v21f: unit-length base (see slice note) — slats overshot too.
      const geo = new THREE.PlaneGeometry(SLICE_H * 0.5, 1);
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.DoubleSide,
        color: beam === 0 ? 0xffd6cc : 0xb8d4ff,
      });
      const mesh = new THREE.Mesh(geo, mat);
      mesh.userData = { beam, slatIdx: si, uFrac };
      scene.add(mesh);
      slats.push(mesh);
    }
  }

  for (let i = 0; i < SLICES; i++) {
    const t0 = i / SLICES;
    const t1 = (i + 1) / SLICES;
    const y0 = (t0 - 0.5) * SLICE_H;
    const y1 = (t1 - 0.5) * SLICE_H;
    for (const beam of [0, 1]) {
      // v21f: base length 1 — position/scale multiply a UNIT quad to the
      // exact throw. With BEAM_LEN=3.1 baked in, every slice was ~3.4x
      // over-length, sheets overshooting the projector and punching
      // through the screen to fill the room (the standing white slab).
      const geo = new THREE.PlaneGeometry(1, Math.abs(y1 - y0));
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0,
        depthWrite: false,
        // v21d: slice SHEETS composite normally (two additive sheets crossed
        // the whole room and summed to a white wall); slats stay additive.
        blending: THREE.NormalBlending,
        side: THREE.DoubleSide,
        color: (beam === 0 ? 0xffd6cc : 0xb8d4ff),
      });
      const mesh = new THREE.Mesh(geo, mat);
      const org = beam === 0 ? PROJ : PROJ.clone().setX(PROJ.x + 1.0).setY(PROJ.y - 0.15);
      mesh.userData = { beam, idx: i, yMid: (y0 + y1) / 2 };
      mesh.position.set(0, 0, 0);
      mesh.visible = false;
      scene.add(mesh);
      canvases.push(mesh);
    }
  }

  const frame = { value: 0 };

  // ---------- CPU luma tap (seq-21 fix 2) ----------
  // The WebGPU readback path resolved but rendered black (diagnosed via
  // wallform01.luma.stats). A 2D canvas tap is synchronous and honest: draw
  // the video frame at 32x18, read the pixels, feed CutDetector directly
  // AND per-slice band means for the beam modulation (no more mean-only
  // wash). Band history drives the DELAY-late past beam without ring reads.
  const lumaCanvas = document.createElement("canvas");
  lumaCanvas.width = LUMA_W;
  lumaCanvas.height = LUMA_H;
  const lumaCtx = lumaCanvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

  // per-frame band means (SLICES bands, luma 0..1), ring of length RING
  const bandHistory: Float32Array[] = [];
  const detailHistory: Float32Array[] = [];
  const lumaHistory: Float32Array[] = []; // full 32x18 grids for the past beam
  const pushBandHistory = (bands: Float32Array, detail: Float32Array, luma: Float32Array): void => {
    bandHistory.push(bands);
    detailHistory.push(detail);
    lumaHistory.push(luma);
    if (bandHistory.length > RING) {
      bandHistory.shift();
      detailHistory.shift();
      lumaHistory.shift();
    }
  };
  const bandAt = (framesAgo: number): Float32Array | null => {
    const idx = bandHistory.length - 1 - framesAgo;
    return idx >= 0 ? (bandHistory[idx] ?? null) : null;
  };
  const detailAt = (framesAgo: number): Float32Array | null => {
    const idx = detailHistory.length - 1 - framesAgo;
    return idx >= 0 ? (detailHistory[idx] ?? null) : null;
  };
  const lumaAt = (framesAgo: number): Float32Array | null => {
    const idx = lumaHistory.length - 1 - framesAgo;
    return idx >= 0 ? (lumaHistory[idx] ?? null) : null;
  };

  const computeBandsFromVideo = (video: HTMLVideoElement): { bands: Float32Array; luma: Float32Array; bandDetail: Float32Array } | null => {
    if (video.readyState < 2) return null;
    lumaCtx.drawImage(video, 0, 0, LUMA_W, LUMA_H);
    const data = lumaCtx.getImageData(0, 0, LUMA_W, LUMA_H).data;
    const luma = new Float32Array(LUMA_W * LUMA_H);
    for (let i = 0; i < LUMA_W * LUMA_H; i++) {
      const o = i * 4;
      luma[i] = (0.299 * (data[o] ?? 0) + 0.587 * (data[o + 1] ?? 0) + 0.114 * (data[o + 2] ?? 0)) / 255;
    }
    // 120 bands over 18 rows: each band maps to a fractional row range.
    // v5: also capture 3 x-window means per band (left/mid/right thirds)
    // so slices carry horizontal picture detail, not just row luma.
    const bandDetail = new Float32Array(SLICES * 3);
    const bands = new Float32Array(SLICES);
    const rowsF = bandAt(0);
    void rowsF;
    for (let bi = 0; bi < SLICES; bi++) {
      // slice idx 0 = TOP of frame (y1 above y0 in buildScene ordering)
      const y01 = bi / SLICES; // 0 top .. 1 bottom
      const rowStart = Math.floor(y01 * LUMA_H);
      const rowEnd = Math.max(rowStart + 1, Math.floor(((bi + 1) / SLICES) * LUMA_H));
      let acc = 0;
      let count = 0;
      for (let ry = rowStart; ry < Math.min(rowEnd, LUMA_H); ry++) {
        for (let rx = 0; rx < LUMA_W; rx++) {
          acc += luma[ry * LUMA_W + rx] ?? 0;
          count++;
        }
      }
      bands[bi] = count > 0 ? acc / count : 0;
      // three x-thirds within the band rows
      for (let cx = 0; cx < 3; cx++) {
        let cacc = 0;
        let ccount = 0;
        for (let ry = rowStart; ry < Math.min(rowEnd, LUMA_H); ry++) {
          for (let rx = cx * Math.floor(LUMA_W / 3); rx < (cx + 1) * Math.floor(LUMA_W / 3); rx++) {
            cacc += luma[ry * LUMA_W + rx] ?? 0;
            ccount++;
          }
        }
        bandDetail[bi * 3 + cx] = ccount > 0 ? cacc / ccount : 0;
      }
    }
    return { bands, luma, bandDetail };
  };

  const cutDetector = new CutDetector();
  let lumaFramesSeen = 0;
  const traceAtHolder: { at: number | null } = { at: null };

  return {
    scene,
    camera,
    pastCamera,
    screen,
    iris,
    wallPic,
    shards,
    snapCtx,
    snapTex,
    proj1,
    proj2,
    canvases,
    slats,
    frame,
    traceAt: traceAtHolder.at,
    computeBandsFromVideo,
    bandAt,
    detailAt,
    lumaAt,
    pushBandHistory,
  };
}

export async function mountRuntime(
  renderer: THREE.WebGPURenderer,
  videoLayer: { texture: THREE.VideoTexture; ready: Promise<boolean> },
): Promise<WithholdRuntime> {
  return await sketchEvents.measured("study", "study.mount", { study: STUDY }, async () => {
    const study = buildScene();
    // keep hot colour clipping to a roll-off, not a flat wash (AD seq-49)
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    // seq-24: the mount-time seek raced the video layer AND 120s exceeds
    // this clip's 90s duration (clamped -> looped back to the cards).
    // 55s is inside the film, past both front cards. Re-assert until the
    // time holds (element swaps reset playback to 0).
    const SEEK_TO = 48; // in-point chosen by scrub sheets: +5s = swinging hand on the "11 12 1" dial, +16s = machining/workers — both moving footage, no cards

    // --- the delay line (colour-01): two hidden decoders locked to main ---
    const D_G = 3.0;
    const D_B = 6.0;
    const MAIN_DUR = 90.02;
    const DRIFT_LIMIT = 0.12;
    const makeDelayVideo = (): { video: HTMLVideoElement; texture: THREE.VideoTexture } => {
      const video = document.createElement("video");
      video.src = "/videos/conquerb1943.mp4";
      video.muted = true;
      video.loop = true;
      video.playsInline = true;
      video.style.display = "none";
      document.body.appendChild(video);
      const texture = new THREE.VideoTexture(video);
      texture.colorSpace = THREE.SRGBColorSpace;
      return { video, texture };
    };
    const delayed = { g: makeDelayVideo(), b: makeDelayVideo() };
    let decodersLive = false;
    let seekAttempts = 0;
    const revealHolder = { revealed: false };
    const vidOf = (): HTMLVideoElement | null =>
      (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image ?? null;
    // v13 (seq-27): DETERMINISTIC first paint. The v8 reveal raced a stale
    // 'seeked' from the OLD element (already at SEEK_TO from a prior pass)
    // firing while the fresh element sat at 0 — the card then showed full.
    // Now: screen map = NULL at mount; the map is assigned only when the
    // seeked event arrives from the CURRENT element AT SEEK_TO.
    const screenMat = study.screen.material as THREE.MeshBasicMaterial;
    const unwrapRepeat = (tex: THREE.Texture): void => {
      tex.wrapS = THREE.RepeatWrapping;
      tex.repeat.x = -1; // cylinder inner face reads mirrored otherwise (seq-23)
    };
    unwrapRepeat(videoLayer.texture);
    screenMat.map = null; // nothing chosen yet -> nothing shown
    // withhold-01 SHUTTER: one operation, one cut — but AUTHORED. The
    // seeked event ARMS the aperture (the image is ready); the shutter
    // opens only once the authored withhold has elapsed (WITHHOLD_MS
    // after mount), so the closed plate reads long enough to be a state,
    // not a frame. Ring lights + film in the same frame: a cut, not a fade.
    const WITHHOLD_MS = 9_000;
    const irisMat = study.iris.material as THREE.MeshBasicMaterial;
    let armedAtMs: number | null = null;
    const maybeOpen = (elapsed: number): void => {
      if (armedAtMs === null || elapsed < WITHHOLD_MS) return;
      const vid = vidOf();
      if (!vid || Math.abs(vid.currentTime - SEEK_TO) > 1.5) return;
      openAperture(Number(vid.currentTime.toFixed(2)), armedAtMs === null ? "backstop" : "seeked");
    };
    // withhold-01.2 (AD seq-39): the shutter SNAPSHOT — the frame the
    // screen shows at the aperture is captured; the second beam lands it
    // on the wall 3 seconds later. The past is visibly behind: the screen
    // moves on, the wall holds the shutter frame.
    const shutterSnapshot: { bands: Float32Array | null } = { bands: null };
    const snapProof: { mean: number; count: number } = { mean: -1, count: 0 };
    const openAperture = (at: number, via: "seeked" | "backstop"): void => {
      if (revealHolder.revealed) return;
      revealHolder.revealed = true;
      const vidNow = vidOf();
      if (vidNow && vidNow.readyState >= 2) {
        const snap = study.computeBandsFromVideo(vidNow);
        if (snap) shutterSnapshot.bands = snap.bands;
        study.snapCtx.drawImage(vidNow, 0, 0, 256, 144); // the legible past
        study.snapTex.needsUpdate = true;
        // freeze proof: sample the snapshot's mean at capture and again at
        // +10s; both events must carry the SAME number if the wall is frozen
        const px = study.snapCtx.getImageData(0, 0, 256, 144).data;
        let acc = 0;
        let cnt = 0;
        for (let i = 0; i < px.length; i += 160) {
          acc += (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
          cnt++;
        }
        snapProof.mean = acc / cnt;
        snapProof.count = 0;
      }
      irisMat.color.setHex(0xbcd4ff);
      irisMat.opacity = 1;
      // the shutter opens the split: 0/0/0 base — same frame, same texture,
      // film visible through the node material before any delay offsets
      // mirrored UV inside the node (cylinder inner face reads flipped)
      const uvm = vec2(uv().x.mul(-1).add(1), uv().y);
      const tR = texture(videoLayer.texture, uvm as never);
      const splitC = vec3(tR.r, tR.g, tR.b);
      const greyC = splitC.r.mul(0.299).add(splitC.g.mul(0.587)).add(splitC.b.mul(0.114));
      (screenMat as unknown as { colorNode: unknown }).colorNode = mix(greyC, splitC, 2.0).mul(1.25);
      (screenMat as unknown as { needsUpdate: boolean }).needsUpdate = true;
      aperturedAtMs = performance.now();
      void sketchEvents
        .emitInfo("study", "wallform01.aperture", { at, via })
        .catch(() => undefined);
    };
    let aperturedAtMs: number | null = null;
    const onSeeked = (ev: Event): void => {
      if (revealHolder.revealed) return; // v21: one-shot guard
      const vid = ev.target as HTMLVideoElement;
      if (vid !== vidOf()) return; // stale element's event: ignore
      if (Math.abs(vid.currentTime - SEEK_TO) >= 1.5) return; // wrong place
      if (armedAtMs === null) { armedAtMs = performance.now(); armedVia = "seeked"; }
      void sketchEvents
        .emitInfo("study", "wallform01.armed", { at: Number(vid.currentTime.toFixed(2)) })
        .catch(() => undefined);
    };
    let armedVia: "seeked" | "backstop" = "backstop";
    videoLayer.texture.addEventListener?.("dispose", () => {
      if (screenMat.map === videoLayer.texture) screenMat.map = null;
    });
    vidOf()?.addEventListener("seeked", onSeeked);
    // backstop reveal check (seq-29): runs every frame; fires if seeked
    // never does — readyState>=2 AND currentTime within 0.5s of SEEK_TO
    let firstStepAt: number | null = null;
    let revealProofLogs = 0;
    let bubbleLogs = 0;
    const railAudit: { mins?: { d0: number; d1: number }; minD0: number; minD1: number; reported: boolean } = { minD0: Infinity, minD1: Infinity, reported: false };
    const revealProofTick = (elapsed: number): void => {
      if (revealHolder.revealed) return;
      if (revealProofLogs >= 30 || elapsed - revealProofLogs * 1000 < 1000) return;
      revealProofLogs++;
      const vid = vidOf();
      void sketchEvents
        .emitInfo("study", "wallform01.arm.proof", {
          elapsed: Number(elapsed.toFixed(0)),
          readyState: vid?.readyState ?? -1,
          t: Number((vid?.currentTime ?? -1).toFixed(2)),
          want: SEEK_TO,
        })
        .catch(() => undefined);
    };
    const revealBackstop = (): void => {
      if (revealHolder.revealed) return;
      const vid = vidOf();
      if (!vid) return;
      if (vid.readyState >= 2 && Math.abs(vid.currentTime - SEEK_TO) <= 0.5) {
        if (armedAtMs === null) { armedAtMs = performance.now(); armedVia = "backstop"; }
      }
    };
    const seekTick = (): void => {
      if (revealHolder.revealed) return; // one-shot: never re-seek after reveal
      const vid = vidOf();
      if (!vid) return;
      if (Math.abs(vid.currentTime - SEEK_TO) <= 1.5) return; // already there
      vid.currentTime = SEEK_TO;
      seekAttempts++;
      if (Math.abs(vid.currentTime - SEEK_TO) > 1.5 && seekAttempts < 20) setTimeout(seekTick, 1000);
    };
    seekTick();
    document.addEventListener("seeked", onSeeked, true); // capture phase: element swaps included
    const detector = new CutDetector();

    // drift lock + delay live swap (colour-01)
    let splitLive = false;
    let probeFrames = 0;
    let wallProofEmitted = false;
    let wallMean = 0;
    let bestWallMean = 0;
    let bestWallData: ImageData | null = null;
    let bestCommitted = false;
    let driftEMA = { g: 1, b: 1 };
    let driftTick = 0;
    const colourStep = (): void => {
      const main = vidOf();
      if (!main || main.readyState < 2 || main.currentTime < D_B + 0.4) return;
      if (!decodersLive) {
        void delayed.g.video.play().catch(() => undefined);
        void delayed.b.video.play().catch(() => undefined);
        decodersLive = true;
      }
      for (const [which, dec, d] of [["g", delayed.g, D_G], ["b", delayed.b, D_B]] as const) {
        if (dec.video.readyState < 1) continue;
        const want = (main.currentTime - d + MAIN_DUR) % MAIN_DUR;
        let diff = dec.video.currentTime - want;
        if (Math.abs(diff) > MAIN_DUR / 2) diff -= Math.sign(diff) * MAIN_DUR;
        if (Math.abs(diff) > DRIFT_LIMIT) dec.video.currentTime = want;
        driftEMA[which] = driftEMA[which] * 0.9 + Math.min(Math.abs(diff), MAIN_DUR / 2) * 0.1;
      }
      driftTick++;
      if (!splitLive && delayed.g.video.readyState >= 2 && delayed.b.video.readyState >= 2
        && driftEMA.g < 0.05 && driftEMA.b < 0.05) {
        splitLive = true;
        void sketchEvents
          .emitInfo("study", "wallform01.lockAt", {
            mainT: Number(main.currentTime.toFixed(2)),
          })
          .catch(() => undefined);
        const uvm = vec2(uv().x.mul(-1).add(1), uv().y);
        const tG = texture(delayed.g.texture, uvm as never);
        const tB = texture(delayed.b.texture, uvm as never);
        const tR = texture(videoLayer.texture, uvm as never);
        const split = vec3(tR.r, tG.g, tB.b);
        const grey = split.r.mul(0.299).add(split.g.mul(0.587)).add(split.b.mul(0.114));
        const sm = study.screen.material as unknown as { colorNode: unknown; needsUpdate: boolean };
        // AD seq-49 probe: for the first 200 locked frames the plate renders
        // abs(R-B) as PURE magenta — black plate proves the ring is not
        // offset, magenta proves the offset is there. Then the real split.
        const mag = split.b.sub(split.r).abs().mul(6);
        sm.colorNode = vec3(mag, mag, mag);
        sm.needsUpdate = true;
        void sketchEvents
          .emitInfo("study", "wallform01.splitLive", {
            mainT: Number(main.currentTime.toFixed(2)),
            gT: Number(delayed.g.video.currentTime.toFixed(2)),
            bT: Number(delayed.b.video.currentTime.toFixed(2)),
          })
          .catch(() => undefined);
      }
      if (splitLive && probeFrames < 200) {
        probeFrames++;
        if (probeFrames === 200) {
          const uvm2 = vec2(uv().x.mul(-1).add(1), uv().y);
          const tG2 = texture(delayed.g.texture, uvm2 as never);
          const tB2 = texture(delayed.b.texture, uvm2 as never);
          const tR2 = texture(videoLayer.texture, uvm2 as never);
          const split2 = vec3(tR2.r, tG2.g, tB2.b);
          const grey2 = split2.r.mul(0.299).add(split2.g.mul(0.587)).add(split2.b.mul(0.114));
          const sm2 = study.screen.material as unknown as { colorNode: unknown; needsUpdate: boolean };
          sm2.colorNode = mix(grey2, split2, 2.0).mul(1.25);
          sm2.needsUpdate = true;
          void sketchEvents
            .emitInfo("study", "wallform01.probeDone", {})
            .catch(() => undefined);
        }
      }
      if (driftTick % 180 === 1) {
        void sketchEvents
          .emitInfo("study", "wallform01.drift", {
            main: Number(main.currentTime.toFixed(2)),
            g: Number(delayed.g.video.currentTime.toFixed(2)),
            b: Number(delayed.b.video.currentTime.toFixed(2)),
            split: splitLive,
          })
          .catch(() => undefined);
      }
    };
    let lumaFramesSeen = 0;
    void sketchEvents.emitInfo("study", "study.ready", { study: STUDY, delay: DELAY }).catch(() => undefined);

    return {
      scene: study.scene,
      camera: study.camera,
      delay: DELAY,
      onPointer(p) {
        // pointer cut = an intervention the room feels: projector pulse
        study.traceAt = performance.now();
        void sketchEvents
          .emitInfo("study", "wallform01.intervention", { sha: p.sha.slice(0, 16), source: "pointer" })
          .catch(() => undefined);
      },
      step(r, now, delta) {
        void delta; // signature parity with StudyRuntime
        // colour-01 in-point hard guard (AD seq-48): during the first 30s
        // a re-opened or wrapped element must return to SEEK_TO before the
        // film plays free — the in-point survives every element swap.
        {
          const vMain = vidOf();
          const elapsedNow = now - (firstStepAt ?? now);
          if (vMain && elapsedNow < 30_000 && firstStepAt === firstStepAt) {
            if (vMain.readyState >= 1 && vMain.currentTime < 60) {
              vMain.currentTime = SEEK_TO;
            }
          }
        }
        colourStep();
        // seq-30: key the rail (and everything else time-based) to
        // ELAPSED SINCE FIRST STEP, not the shared animation clock —
        // two loads of the same sha must open on the same authored frame
        if (firstStepAt === null) firstStepAt = now;
        const elapsed = now - (firstStepAt ?? now);
        revealBackstop();
        revealProofTick(elapsed);
        maybeOpen(elapsed);
        const n = study.frame.value;
        const apertured = revealHolder.revealed;
        // v21 (AD seq-32): the re-assert loop pinned the video at 63
        // forever — seekTick fired every second even after reveal, so the
        // "picture" was one frame. Seek re-assert is now DEAD once the
        // reveal fires: the film plays free from there.
        if (!revealHolder.revealed && n % 60 === 0 && seekAttempts < 6) seekTick();

        // CPU luma tap (honest, synchronous): bands for beams + CutDetector
        const video = (videoLayer.texture as unknown as { image?: HTMLVideoElement }).image;
        const tap = video ? study.computeBandsFromVideo(video) : null;
        if (tap) {
          study.pushBandHistory(tap.bands, tap.bandDetail, tap.luma);
          const frame = { pixels: Array.from(tap.luma), width: LUMA_W, height: LUMA_H };
          lumaFramesSeen++;
          if (lumaFramesSeen % 600 === 1) {
            let sum = 0;
            for (const v of tap.luma) sum += v;
            void sketchEvents
              .emitInfo("study", "wallform01.luma.stats", {
                seen: lumaFramesSeen,
                meanLuma: Number((sum / tap.luma.length).toFixed(2)),
              })
              .catch(() => undefined);
          }
          if (detector.push(frame)) {
            study.traceAt = performance.now();
            void sketchEvents
              .emitInfo("study", "wallform01.cut", { at: Number(study.traceAt.toFixed(0)), source: "film" })
              .catch(() => undefined);
          }
        }

        // v20 (AD seq-31): open LOW and NEAR the screen — the film is the
        // largest thing in the opening frame — hold ~7s, then arc back into
        // the room. The old default (0.4,0.85,5.9) sat INSIDE the near
        // beam's volume and read as a white slab for 20s.
        // withhold-01 rail: THREE authored positions, each dwelled >=8s,
        // each catching a different relation of source / withheld past /
        // live cut. Opening = the v18 proven default (AD seq-36).
        const RAIL: Array<{ t: number; p: [number, number, number]; l: [number, number, number] }> = [
          { t: 0.0, p: [0.4, 0.85, 5.9], l: [-0.15, 1.1, 0.0] }, // relation (a): both surfaces framed
          { t: 0.25, p: [0.55, 0.95, 6.1], l: [-0.6, 1.1, -0.1] }, // dwelled hold ~12s across the shutter moment
          { t: 0.55, p: [1.0, 1.05, 6.2], l: [-0.7, 1.15, -0.3] }, // relation (c): beam lit, opening historic
          { t: 1.0, p: [0.4, 0.85, 5.9], l: [-0.15, 1.1, 0.0] }, // loop close
        ];
        const railAt = (f: number): { p: THREE.Vector3; l: THREE.Vector3 } => {
          let i = 0;
          for (let k = 0; k < RAIL.length - 1; k++) {
            if (f >= (RAIL[k]?.t ?? 0) && f <= (RAIL[k + 1]?.t ?? 0)) {
              i = k;
              break;
            }
          }
          const a = RAIL[i] ?? RAIL[0]!;
          const b = RAIL[i + 1] ?? RAIL[RAIL.length - 1]!;
          const span = (b.t - a.t) + 1e-9;
          const u = Math.min(1, Math.max(0, (f - a.t) / span));
          const ease = u * u * (3 - 2 * u); // smoothstep
          return {
            p: new THREE.Vector3(
              a.p[0] + (b.p[0] - a.p[0]) * ease,
              a.p[1] + (b.p[1] - a.p[1]) * ease,
              a.p[2] + (b.p[2] - a.p[2]) * ease,
            ),
            l: new THREE.Vector3(
              a.l[0] + (b.l[0] - a.l[0]) * ease,
              a.l[1] + (b.l[1] - a.l[1]) * ease,
              a.l[2] + (b.l[2] - a.l[2]) * ease,
            ),
          };
        };
        const rail = railAt((elapsed % 48_000) / 48_000);
        study.camera.position.copy(rail.p);
        study.camera.lookAt(rail.l);
        // transient flash: the intervention trace the room feels
        const since = now - (study.traceAt ?? -1e9);
        const cutGlow = since >= 0 && since < 900 ? Math.max(0, 1 - since / 900) : 0;

        // v12: camera-beam proximity falloff — the camera's distance from
        // each projector drives a fade on that beam; at close range the
        // wash back off so room + picture stay readable (v11 15s frame)
        // v20 (AD seq-31): bubble fade by CAMERA-TO-BEAM-SEGMENT distance —
        // the old distance-to-projector fade missed the real failure (the
        // camera INSIDE the beam cone between origin and landing). Inside
        // ~1m of the beam line: alpha to ~0.15; full alpha by ~3m.
        const B0_END = new THREE.Vector3(0.0, 1.6, 1.2); // beam 0 lands on the screen
        const B1_END = new THREE.Vector3(2.2, 1.0, -7.55); // beam 1 lands on the back wall
        const segDist = (a: THREE.Vector3, b: THREE.Vector3): number => {
          const ab = b.clone().sub(a);
          const t = Math.max(0, Math.min(1, study.camera.position.clone().sub(a).dot(ab) / ab.lengthSq()));
          return study.camera.position.distanceTo(a.clone().addScaledVector(ab, t));
        };
        const bubble = (d: number): number => {
          const u = Math.min(1, Math.max(0, (d - 1.0) / 2.0)); // 1m → 3m ramp
          return 0.15 + 0.85 * (u * u * (3 - 2 * u));
        };
        const fade1 = bubble(segDist(PROJ, B0_END));
        const fade2 = bubble(segDist(PROJ_OFF, B1_END));
        // AD seq-38 rail-bubble audit: distance from the camera to every
        // beam-slice SEGMENT each frame; per-load minimum logged at exit.
        // Assert: never <3m. Beam lands sampled from the real geometry.
        if (!railAudit.mins) {
          const lands0: THREE.Vector3[] = [];
          for (let i = 0; i <= 24; i++) {
            const yMid = -1.1 + (2.2 * i) / 24;
            const u = -0.02 + yMid * 0.16;
            lands0.push(new THREE.Vector3(SCREEN_R * Math.sin(u), 1.1 + yMid, SCREEN_R * Math.cos(u) - 2.2));
          }
          const lands1: THREE.Vector3[] = [];
          for (const drift of [-0.9, 0, 0.9]) {
            for (const yMid of [-1.1, 0, 1.1]) {
              lands1.push(new THREE.Vector3(2.2 + yMid * 2.1 + drift, 1.0 + yMid * 1.35 + drift * 0.4, -7.55));
            }
          }
          const dToLands = (org: THREE.Vector3, lands: THREE.Vector3[]): number =>
            Math.min(...lands.map((L) => segDist(org, L)));
          railAudit.mins = { d0: dToLands(PROJ, lands0), d1: dToLands(PROJ_OFF, lands1) };
        }
        railAudit.minD0 = Math.min(railAudit.minD0, fade1 < 1 ? segDist(PROJ, B0_END) : railAudit.minD0);
        railAudit.minD1 = Math.min(railAudit.minD1, fade2 < 1 ? segDist(PROJ_OFF, B1_END) : railAudit.minD1);
        if (!railAudit.reported && elapsed > 48_000) {
          railAudit.reported = true;
          void sketchEvents
            .emitInfo("study", "wallform01.rail.audit", {
              minD0: Number(railAudit.minD0.toFixed(2)),
              minD1: Number(railAudit.minD1.toFixed(2)),
              pass: railAudit.minD0 >= 3 && railAudit.minD1 >= 3,
            })
            .catch(() => undefined);
        }
        // v21c: grazing-angle attenuation — a thin additive quad sheet
        // viewed edge-on stacks 120 slabs onto the same pixels (the white
        // wall). Attenuate each beam slice by |dot(viewDir, planeNormal)|:
        // face-on reads full, edge-on reads ~0, so the cone keeps a body
        // from most views but dissolves along its own plane.
        const viewDir = new THREE.Vector3();
        const planeNormalLocal = new THREE.Vector3(0, 0, 1); // quad normal before rotation
        study.camera.getWorldDirection(viewDir);
        const graze = (mesh: THREE.Mesh): number => {
          const nrm = planeNormalLocal.clone().applyQuaternion(mesh.quaternion).normalize();
          const a = Math.abs(nrm.dot(viewDir));
          return 0.08 + 0.92 * a; // keep a faint body even at grazing
        };
        // v21 (AD seq-32): bubble-proof — computed alphas, once a second,
        // first 10s, so a non-biting fade is VISIBLE in the console
        if (bubbleLogs < 10) {
          const elS = elapsed / 1000;
          if (Math.floor(elS) > bubbleLogs) {
            bubbleLogs = Math.floor(elS);
            void sketchEvents
              .emitInfo("study", "wallform01.beam.alpha", {
                s: bubbleLogs,
                cam: [
                  Number(study.camera.position.x.toFixed(2)),
                  Number(study.camera.position.y.toFixed(2)),
                  Number(study.camera.position.z.toFixed(2)),
                ],
                d0: Number(segDist(PROJ, B0_END).toFixed(2)),
                d1: Number(segDist(PROJ_OFF, B1_END).toFixed(2)),
                fade1: Number(fade1.toFixed(3)),
                fade2: Number(fade2.toFixed(3)),
              })
              .catch(() => undefined);
          }
        }

        // per-slice beams: brightness = the FRAME at that slice's row band
        // (live bands for beam 0; DELAY-late history for beam 1)
        const live = revealHolder.revealed && tap ? tap.bands : null;
        // the wall beam: dark until ARRIVAL_MS after the shutter, then the
        // frozen shutter frame — the past is visibly behind the screen.
        const sinceAperture = aperturedAtMs === null ? -1 : now - aperturedAtMs;
        const arrival = sinceAperture >= 0 && sinceAperture < 3_000
          ? null
          : shutterSnapshot.bands;
        const past = arrival as Float32Array | null;
        const pastLuma = revealHolder.revealed && tap ? study.lumaAt(DELAY) : null;
        for (const m of study.canvases) {
          const { beam, idx, yMid } = m.userData as { beam: number; idx: number; yMid: number };
          const org = beam === 0 ? PROJ : PROJ_OFF;
          const u = -0.02 + yMid * 0.16;
          const sx = SCREEN_R * Math.sin(u);
          const sz = SCREEN_R * Math.cos(u) - 2.2;
          // beam 1 (the delayed past) misses the screen and lands on the
          // BACK WALL, spread wide; v5: the landing point drifts with the
          // delayed bands so the past visibly moves on the wall (critique)
          const pastBand = past?.[idx] ?? 0;
          const drift = (pastBand - 0.35) * 2.6;
          const tx = beam === 0 ? sx : 2.2 + yMid * 2.1 + drift;
          const ty = beam === 0 ? 1.1 + yMid : 1.0 + yMid * 1.35 + drift * 0.4;
          const tz = beam === 0 ? sz : -7.55;
          const dir = new THREE.Vector3(tx - org.x, ty - org.y, tz - org.z);
          const len = dir.length();
          m.position.copy(org).addScaledVector(dir, 0.5);
          m.scale.set(len, 1, 1);
          m.visible = true;
          const yaw = Math.atan2(dir.z, dir.x);
          const pitch = Math.atan2(dir.y, Math.hypot(dir.x, dir.z));
          m.rotation.set(0, -yaw, pitch);
          m.rotateY(Math.PI / 2);
          // v7: the cone IS the picture's footprint. UV-space of this
          // slice's landing point on the screen: u spans [-0.02, +0.14],
          // map to a col window of the luma tap (LUMA_W wide); the row is
          // this slice's band. That sampled patch's MEAN drives the slice —
          // dark picture regions read as dark gaps IN the beam cone.
          // withhold-01: plain band-mean stripes — the arrival is the
          // content, not the picture-in-the-cone (v21 lesson banked).
          const bands = beam === 0 ? live : past;
          const bandL = bands?.[idx] ?? 0;
          // withheld: no image, no beam — arrival hasn't happened yet
          if (!apertured) {
            (m.material as THREE.MeshBasicMaterial).opacity = 0;
            continue;
          }
          const bright = Math.min(1, bandL * 1.3 + cutGlow * 0.35);
          const fade = beam === 0 ? fade1 : fade2;
          const mm = m.material as THREE.MeshBasicMaterial;
          mm.opacity = (beam === 0 ? 0.04 + bright * 0.24 : 0.025 + bright * 0.12) * fade * graze(m) * (beam === 0 ? 0.5 : 0.35);
        }

        // beam-01 vertical slats (now live, was dead since v13 rewrites):
        // each slat is a thin bar across the beam's height at one arc
        // fraction; brightness = the luma tap's COLUMN at that fraction
        // (rows summed), so vertical picture structure joins band detail.
        const SLATS = 16;
        for (const sm2 of study.slats) {
          const { beam: bBeam, slatIdx: bSi, uFrac: bU } = sm2.userData as { beam: number; slatIdx: number; uFrac: number };
          const org = bBeam === 0 ? PROJ : PROJ_OFF;
          if (!(revealHolder.revealed && tap)) {
            sm2.visible = false;
            continue;
          }
          sm2.visible = true;
          const bU2 = -0.02 + bU * 0.16;
          const bsx = SCREEN_R * Math.sin(bU2);
          const bsz = SCREEN_R * Math.cos(bU2) - 2.2;
          const bdir = new THREE.Vector3(bsx - org.x, 1.1 - org.y, bsz - org.z);
          const blen = bdir.length();
          // v21b: 16 slats were ALL copied to the beam midpoint — a
          // 16-deep coplanar additive stack = the white slab. Distribute
          // them ALONG the beam instead (each owns 1/16 of the throw).
          sm2.position.copy(org).addScaledVector(bdir, (bSi + 0.5) / SLATS);
          sm2.scale.set(1, blen, 1);
          sm2.rotation.set(0, -Math.atan2(bdir.z, bdir.x), Math.atan2(bdir.y, Math.hypot(bdir.x, bdir.z)));
          sm2.rotateZ(Math.PI / 2);
          const cF = Math.max(0, Math.min(LUMA_W - 1, bU * 0.14 * LUMA_W));
          const bcol = Math.max(0, Math.floor(cF - 1));
          const bgrid = bBeam === 0 ? tap.luma : pastLuma;
          let bcacc = 0;
          let bcn = 0;
          if (bgrid) {
            for (let ry = 0; ry < LUMA_H; ry++) {
              bcacc += bgrid[ry * LUMA_W + bcol] ?? 0;
              bcn++;
            }
          }
          const bcolL = bcn > 0 ? bcacc / bcn : 0;
          const bbright = Math.min(1, bcolL * 1.35 + cutGlow * 0.3);
          const bfade = bBeam === 0 ? fade1 : fade2;
          const bmm = sm2.material as THREE.MeshBasicMaterial;
          bmm.opacity = (bBeam === 0 ? 0.016 + bbright * 0.18 : 0.012 + bbright * 0.075) * bfade * graze(sm2) * (bBeam === 0 ? 0.5 : 0.35);
        }
        void SLATS;

        // lens breathing: projectors inhale on their own cadence; cut flash
        const pulse = Math.sin((now / 2400) % (Math.PI * 2)) * 0.5 + 0.5;
        const p1 = study.proj1.material as THREE.MeshStandardMaterial;
        const p2 = study.proj2.material as THREE.MeshStandardMaterial;
        p1.emissiveIntensity = 0.25 + pulse * 0.45 + cutGlow * 0.8;
        p2.emissiveIntensity = 0.25 + (1 - pulse) * 0.35 + cutGlow * 0.5;
        // .3: the wall picture fades in at arrival (+3s), holds the past
        const wallMat = study.wallPic.material as THREE.MeshBasicMaterial;
        for (const sh of study.shards) {
          (sh.material as THREE.MeshBasicMaterial).opacity = wallMat.opacity;
          (sh.material as THREE.MeshBasicMaterial).color.setScalar(3.6);
        }
        const openMs = aperturedAtMs === null ? -1e9 : now - aperturedAtMs;
        if (openMs >= 3_000 && snapProof.count < 3 && (snapProof.count === 0 || openMs >= (snapProof.count + 1) * 10_000)) {
          snapProof.count++;
          const px = study.snapCtx.getImageData(0, 0, 256, 144).data;
          let acc = 0;
          let cnt = 0;
          for (let i = 0; i < px.length; i += 160) {
            acc += (px[i]! + px[i + 1]! + px[i + 2]!) / 3;
            cnt++;
          }
          void sketchEvents
            .emitInfo("study", "wallform01.wall.proof", { sample: snapProof.count, mean: Number((acc / cnt).toFixed(2)) })
            .catch(() => undefined);
        }
        // colour-01.2 regression fix (AD seq-50 #1): the aperture-time
        // capture can land on a blank frame (seek race). Redraw every
        // frame for 2.5s of open time — the last draw is a decoded frame.
        // colour-01.2c: keep redrawing until the canvas is legible (mean
        //>=20) or 8s elapses — the shutter lands on a legitimately dark
        // stretch (well/pendulum at 48), not a race.
        if (openMs >= 0 && openMs < 8_000 && (openMs < 3_100 || wallMean < 20)) {
          const vw = vidOf();
          if (vw && vw.readyState >= 2) {
            study.snapCtx.drawImage(vw, 0, 0, 256, 144);
            study.snapTex.needsUpdate = true;
            if (study.frame.value % 6 === 0) {
              const rx = study.snapCtx.getImageData(0, 0, 256, 144).data;
              let ra = 0;
              for (let ri = 0; ri < rx.length; ri += 640) {
                ra += (rx[ri]! + rx[ri + 1]! + rx[ri + 2]!) / 3;
              }
              wallMean = ra / ((rx.length / 640) | 0);
              if (wallMean > bestWallMean) {
                bestWallMean = wallMean;
                bestWallData = study.snapCtx.getImageData(0, 0, 256, 144);
              }
            }
          }
        } else if (openMs >= 8_000 && wallMean < 20 && bestWallData && !bestCommitted) {
          // the first 8s never cleared 20: commit the brightest frame seen
          bestCommitted = true;
          study.snapCtx.putImageData(bestWallData, 0, 0);
          study.snapTex.needsUpdate = true;
          wallMat.color.setScalar(2.6 + (20 - bestWallMean) * 0.12); // darker capture, louder drive
        }
        wallMat.opacity = openMs >= 3_000
          ? Math.min(1, (openMs - 3_000) / 900)
          : 0;
        wallMat.color.setScalar(2.6); // colour-01.2: capture frames darker than .3 (mean 7 measured); overdrive harder
        wallMat.needsUpdate = true;
        if (!wallProofEmitted && openMs >= 3100) {
          wallProofEmitted = true;
          const wpx = study.snapCtx.getImageData(0, 0, 256, 144).data;
          let wacc = 0;
          let wcnt = 0;
          for (let wi = 0; wi < wpx.length; wi += 160) {
            wacc += (wpx[wi]! + wpx[wi + 1]! + wpx[wi + 2]!) / 3;
            wcnt++;
          }
          void sketchEvents
            .emitInfo("study", "wallform01.wall.mean", { mean: Number((wacc / wcnt).toFixed(2)) })
            .catch(() => undefined);
        }

        const sm = study.screen.material as THREE.MeshBasicMaterial;
        if (apertured) {
          sm.color.setScalar(1);
        } else {
          sm.color.setScalar(0.05); // closed plate
        }
        // the iris ring: unlit while closed, lit 1.2s around the shutter,
        // then fades to a faint trace (the boundary happened)
        const sinceOpen = aperturedAtMs === null ? -1e9 : now - aperturedAtMs;
        const ringBeat = sinceOpen >= 0 && sinceOpen < 1200
          ? Math.max(0, 1 - sinceOpen / 1200)
          : 0;
        const im = study.iris.material as THREE.MeshBasicMaterial;
        if (!apertured) {
          im.opacity = 0.55 + pulse * 0.1;
          im.color.setHex(0x1a2030);
        } else {
          im.opacity = 0.15 + ringBeat * 0.85;
          im.color.setHex(ringBeat > 0.05 ? 0xbcd4ff : 0x2a3346);
        }

        r.render(study.scene, study.camera);
        study.frame.value = n + 1;
      },
      onResize(w, h) {
        study.camera.aspect = w / h;
        study.camera.updateProjectionMatrix();
        study.pastCamera.aspect = w / h;
        study.pastCamera.updateProjectionMatrix();
      },
      dispose() {
        for (const m of study.slats) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
        for (const m of study.canvases) {
          m.geometry.dispose();
          (m.material as THREE.Material).dispose();
        }
        study.wallPic.geometry.dispose();
        (study.wallPic.material as THREE.Material).dispose();
        study.screen.geometry.dispose();
        (study.screen.material as THREE.Material).dispose();
        study.proj1.geometry.dispose();
        (study.proj1.material as THREE.Material).dispose();
        study.proj2.geometry.dispose();
        (study.proj2.material as THREE.Material).dispose();
      },
    };
  });
}

export { DELAY, RING, STUDY };
