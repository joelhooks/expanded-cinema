import { describe, expect, it } from "vitest";
import { CutDetector, isHardCut, meanAbsDiff, type LumaFrame } from "../src/cut-detection";

const frame = (v: number, w = 4, h = 4): LumaFrame => ({ pixels: Array(w * h).fill(v), width: w, height: h });

const frameFrom = (vals: readonly number[], w = 4, h = 4): LumaFrame => ({
  pixels: [...vals],
  width: w,
  height: h,
});

describe("meanAbsDiff", () => {
  it("is 0 for identical frames", () => {
    expect(meanAbsDiff(frame(128), frame(128))).toBe(0);
  });

  it("is normalized to 0..1 over the luma scale", () => {
    // every pixel differs by 255 → 1.0
    expect(meanAbsDiff(frame(0), frame(255))).toBeCloseTo(1.0);
    // every pixel differs by 25.5 → 0.1
    expect(meanAbsDiff(frame(0), frame(25))).toBeCloseTo(25 / 255, 5);
  });

  it("rejects mismatched frame sizes", () => {
    expect(() => meanAbsDiff(frame(0, 4, 4), frame(0, 2, 2))).toThrow(/mismatch/);
  });

  it("rejects wrong pixel array lengths", () => {
    const bad = { pixels: [1, 2, 3], width: 4, height: 4 };
    expect(() => meanAbsDiff(frame(0), bad as LumaFrame)).toThrow(/length/);
  });
});

describe("isHardCut", () => {
  it("false for within-scene motion (small diff)", () => {
    expect(isHardCut(frame(128), frame(135))).toBe(false); // diff ≈ 0.027
  });

  it("true across a structural flip (black→bright scene)", () => {
    expect(isHardCut(frame(10), frame(240))).toBe(true); // diff ≈ 0.90
  });

  it("custom threshold can lower the bar", () => {
    expect(isHardCut(frame(128), frame(135), 0.02)).toBe(true);
  });
});

describe("CutDetector", () => {
  it("fires exactly once across a cut", () => {
    const d = new CutDetector();
    expect(d.push(frame(10))).toBe(false); // first frame never a cut
    expect(d.push(frame(12))).toBe(false); // motion
    expect(d.push(frame(240))).toBe(true); // cut
    expect(d.push(frame(242))).toBe(false); // post-cut motion
  });

  it("reset clears the previous frame", () => {
    const d = new CutDetector();
    d.push(frame(10));
    d.reset();
    expect(d.push(frame(240))).toBe(false);
  });

  it("handles a mixed real-shaped pair (row-major 2x2)", () => {
    const a = frameFrom([0, 0, 0, 0], 2, 2);
    const b = frameFrom([255, 255, 0, 0], 2, 2);
    expect(meanAbsDiff(a, b)).toBeCloseTo(0.5);
  });
});
