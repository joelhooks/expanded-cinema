import { describe, expect, it } from "vitest";

import {
  TRACE_DECAY_MS,
  TRACE_HOLD_MS,
  traceState,
} from "../src/intervention-trace";
import type { TraceEvent } from "../src/intervention-trace";

const at = (ms: number): TraceEvent => ({ at: ms });

describe("traceState", () => {
  it("no event = fully restored", () => {
    expect(traceState(null, 1000)).toEqual({ displacement: 0, legible: false });
  });

  it("at the intervention instant = fully displaced immediately", () => {
    expect(traceState(at(1000), 1000)).toEqual({
      displacement: 1,
      legible: true,
    });
  });

  it("holds rest state through the hold window", () => {
    const { displacement, legible } = traceState(
      at(1000),
      1000 + TRACE_HOLD_MS - 1
    );
    expect(displacement).toBe(1);
    expect(legible).toBe(true);
  });

  it("decays eased after the hold", () => {
    const s = traceState(at(1000), 1000 + TRACE_HOLD_MS + TRACE_DECAY_MS / 2);
    // quad ease at half ramp: (1-0.5)^2 = 0.25
    expect(s.displacement).toBeCloseTo(0.25);
    expect(s.legible).toBe(false);
  });

  it("fully restored after hold + decay", () => {
    const s = traceState(at(1000), 1000 + TRACE_HOLD_MS + TRACE_DECAY_MS + 1);
    expect(s.displacement).toBe(0);
    expect(s.legible).toBe(false);
  });

  it("latest event wins over an older one", () => {
    const s = traceState(at(1000), 12_000); // old+decay done → restored
    expect(s.displacement).toBe(0);
    const s2 = traceState(at(11_900), 12_000); // fresh re-displacement
    expect(s2.displacement).toBe(1);
    expect(s2.legible).toBe(true);
  });
});
