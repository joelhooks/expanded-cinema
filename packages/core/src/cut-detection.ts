/**
 * Hard-cut detection over consecutive downsampled luma frames, per the
 * 2026-09-14 validated finding (critiques/clock-03.md watch note 4):
 * a real cut is a structural difference — global luminance flip + full
 * recomposition — far above any within-scene motion.
 *
 * Pure domain logic: no WebGPU, no DOM. The study layer feeds luma arrays.
 */

export interface LumaFrame {
  /** Downsampled luma values, row-major, width*height. */
  readonly pixels: readonly number[];
  readonly width: number;
  readonly height: number;
}

/**
 * Mean absolute difference between two same-sized luma frames, normalized
 * to 0..1 (luma scale 0..255).
 */
export function meanAbsDiff(a: LumaFrame, b: LumaFrame): number {
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(
      `frame size mismatch: ${a.width}x${a.height} vs ${b.width}x${b.height}`
    );
  }
  if (a.pixels.length !== a.width * a.height) {
    throw new Error(
      `frame a length ${a.pixels.length} != ${a.width * a.height}`
    );
  }
  if (b.pixels.length !== b.width * b.height) {
    throw new Error(
      `frame b length ${b.pixels.length} != ${b.width * b.height}`
    );
  }
  let sum = 0;
  const pa = a.pixels;
  const pb = b.pixels;
  for (let i = 0; i < pa.length; i += 1) {
    sum += Math.abs((pa[i] ?? 0) - (pb[i] ?? 0));
  }
  return sum / (a.pixels.length * 255);
}

/**
 * Default cut threshold. From the watch-note evidence: within-scene motion
 * on 1943 footage stays an order of magnitude below a structural cut. A
 * mean abs diff of 0.12 (30/255 luma on average across the frame) is only
 * reachable by a cut or full-frame flash; motion has never exceeded ~0.03
 * in observed pairs.
 */
export const CUT_THRESHOLD = 0.12;

/** True when the transition a→b is a hard cut. */
export function isHardCut(
  a: LumaFrame,
  b: LumaFrame,
  threshold = CUT_THRESHOLD
): boolean {
  return meanAbsDiff(a, b) >= threshold;
}

/**
 * Ring-buffer-friendly: detect across the last two frames of a stream.
 * Returns the frame pair index (count of frames seen after the cut) so the
 * study layer can timestamp the seed.
 */
export class CutDetector {
  private prev: LumaFrame | null = null;
  private readonly threshold: number;

  constructor(threshold = CUT_THRESHOLD) {
    this.threshold = threshold;
  }

  /** Feed each rendered frame in order; returns true exactly once per cut. */
  push(frame: LumaFrame): boolean {
    if (!this.prev) {
      this.prev = frame;
      return false;
    }
    const cut = isHardCut(this.prev, frame, this.threshold);
    this.prev = frame;
    return cut;
  }

  reset(): void {
    this.prev = null;
  }
}
