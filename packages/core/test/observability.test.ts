import { describe, expect, it } from "vitest";

import {
  makeObservability,
  memorySink,
  validateEvent,
} from "../src/observability";
import type { EventSink, OtelEvent } from "../src/observability";

const base: OtelEvent = {
  action: "renderer.initialize",
  component: "webgpu-renderer",
  durationMs: 42,
  level: "info",
  source: "sketch",
  success: true,
  time: "2026-09-13T00:00:00.000Z",
};

describe("validateEvent", () => {
  it("accepts a good event", () => {
    expect(validateEvent(base).ok).toBe(true);
  });

  it("collects every problem at once", () => {
    const result = validateEvent({
      ...base,
      action: "Bad Action",
      component: "",
      durationMs: -1,
      // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- intentionally invalid input under test.
      level: "loud" as unknown as OtelEvent["level"],
      success: false,
    });
    expect(result.ok).toBe(false);
    expect(result.problems.length).toBe(5);
  });

  it("requires error text when success is false", () => {
    const result = validateEvent({ ...base, success: false });
    expect(result.problems.join("\n")).toContain("error: required");
  });
});

describe("makeObservability", () => {
  it("fans out to sinks and records failures without throwing", async () => {
    const good = memorySink();
    const bad: EventSink = {
      name: "flaky",
      // eslint-disable-next-line @typescript-eslint/require-await -- intentionally rejecting sink with no async body.
      write: async () => "network down",
    };
    const o = makeObservability({ sinks: [good, bad], source: "sketch" });

    await o.emit({
      ...testEmit("renderer.initialize"),
      metadata: { backend: "webgpu" },
    });

    expect(good.events().length).toBe(1);
    expect(o.deadLetters().length).toBe(1);
    expect(o.deadLetters()[0]?.metadata?.sinkError).toBe("network down");
  });

  it("measured emits success envelope with duration", async () => {
    const sink = memorySink();
    let tick = 0;
    const ticks = [100, 250];
    const o = makeObservability({
      now: () => {
        const value = ticks[tick] ?? 300;
        tick += 1;
        return value;
      },
      sinks: [sink],
      source: "sketch",
    });

    await o.measured(
      { action: "renderer.initialize", component: "webgpu-renderer" },
      { backend: "webgpu" },
      // eslint-disable-next-line @typescript-eslint/require-await -- trivial measured op; the promise shape comes from measured().
      async () => "ok"
    );

    const [event] = sink.events();
    expect(event?.success).toBe(true);
    expect(event?.durationMs).toBe(150);
    expect(event?.metadata?.backend).toBe("webgpu");
    expect(event?.action).toBe("renderer.initialize");
  });

  it("measured emits failure envelope and rethrows", async () => {
    const sink = memorySink();
    const o = makeObservability({ sinks: [sink], source: "sketch" });

    await expect(
      o.measured(
        { action: "video.activate", component: "video" },
        undefined,
        // eslint-disable-next-line @typescript-eslint/require-await -- pure-throw operation under measurement.
        async () => {
          throw new Error("decode failed");
        }
      )
    ).rejects.toThrow("decode failed");

    const [event] = sink.events();
    expect(event?.success).toBe(false);
    expect(event?.error).toBe("decode failed");
    expect(event?.level).toBe("error");
  });

  it("dead-letters contract violations so bad events never pollute sinks", async () => {
    const sink = memorySink();
    const o = makeObservability({ sinks: [sink], source: "sketch" });

    // eslint-disable-next-line @typescript-eslint/no-unsafe-type-assertion -- intentionally invalid input under test.
    await o.emit({
      action: "nope",
      component: "c",
      error: "",
      level: "info",
      source: "sketch",
      success: false,
    } as unknown as Parameters<typeof o.emit>[0]);

    expect(sink.events().length).toBe(0);
    expect(o.deadLetters().length).toBe(1);
  });
});

function testEmit(action: string) {
  return {
    action,
    component: "webgpu-renderer",
    level: "info" as const,
    source: "sketch",
    success: true,
  };
}
