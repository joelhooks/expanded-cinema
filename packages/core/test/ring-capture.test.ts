import { describe, expect, it } from "vitest";

import {
  isSameScopeCollision,
  readSlot,
  ringLength,
  writeSlot,
} from "../src/ring-capture";

describe("ringLength", () => {
  it("is delay + 1", () => {
    expect(ringLength(180)).toBe(181);
    expect(ringLength(0)).toBe(1);
  });

  it("rejects negative and non-integer delays", () => {
    expect(() => ringLength(-1)).toThrow();
    expect(() => ringLength(1.5)).toThrow();
  });
});

describe("slots", () => {
  it("writeSlot wraps forward", () => {
    expect(writeSlot(0, 5)).toBe(0);
    expect(writeSlot(4, 5)).toBe(4);
    expect(writeSlot(5, 5)).toBe(0);
  });

  it("readSlot is delay behind and wraps safely for small n", () => {
    const L = ringLength(3); // 4
    expect(readSlot(3, 3, L)).toBe(0); // n=3 reads the frame written at n=0
    expect(readSlot(2, 3, L)).toBe(3); // wraps: reads the slot scheduled next write
    expect(readSlot(200, 3, L)).toBe(mod2(197));
  });

  function mod2(n: number): number {
    return ((n % 4) + 4) % 4;
  }
});

describe("isSameScopeCollision", () => {
  it("never collides when length = delay + 1", () => {
    const L = ringLength(180);
    for (let n = 0; n < 400; n++) {
      expect(isSameScopeCollision(n, 180, L)).toBe(false);
    }
  });

  it("collides when the ring is one too short for a long delay", () => {
    // delay 3 in a ring of 3: readSlot(n-3)=writeSlot(n-3), writer overwrites it this frame only if equal — check specific
    expect(readSlot(3, 3, 3)).toBe(0);
    expect(writeSlot(3, 3)).toBe(0);
    expect(isSameScopeCollision(3, 3, 3)).toBe(true);
  });
});
