import { describe, expect, it } from "vitest";
import { rotate } from "../src/index";

describe("rotate", () => {
  it("returns null for an empty list", () => {
    expect(rotate([], 0)).toBeNull();
  });

  it("wraps deterministically", () => {
    const sources = [
      { file: "a.mp4", hash: null },
      { file: "b.mp4", hash: null },
    ];
    expect(rotate(sources, 2)).toEqual({ file: "a.mp4", hash: null });
    expect(rotate(sources, -1)).toEqual({ file: "b.mp4", hash: null });
  });
});
