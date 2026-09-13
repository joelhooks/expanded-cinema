import { describe, expect, it } from "vitest";
import {
  makeObservability,
  memorySink,
  validateEvent,
  type OtelEvent,
} from "../src/observability";

const base: OtelEvent = {
  time: "2026-09-13T00:00:00.000Z",
  level: "info",
  source: "sketch",
  component: "webgpu-renderer",
  action: "renderer.initialize",
  success: true,
  durationMs: 42,
};

describe("validateEvent", () => {
  it("accepts a good event", () => {
    expect(validateEvent(base).ok).toBe(true);
  });

  it("collects every problem at once", () => {
    const result = validateEvent({
      ...base,
      level: "loud" as OtelEvent["level"],
      component: "",
      action: "Bad Action",
      success: false,
      durationMs: -1,
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
    const bad: import("../src/observability").EventSink = {
      name: "flaky",
      write: async () => "network down",
    };
    const o = makeObservability({ sinks: [good, bad], source: "sketch" });

    await o.emit({ ...testEmit("renderer.initialize"), metadata: { backend: "webgpu" } });

    expect(good.events().length).toBe(1);
    expect(o.deadLetters().length).toBe(1);
    expect(o.deadLetters()[0]?.metadata?.["sinkError"]).toBe("network down");
  });

  it("measured emits success envelope with duration", async () => {
    const sink = memorySink();
    let tick = 0;
    const o = makeObservability({
      sinks: [sink],
      source: "sketch",
      now: () => [100, 250][tick++] ?? 300,
    });

    await o.measured({ component: "webgpu-renderer", action: "renderer.initialize" }, { backend: "webgpu" }, async () => "ok");

    const [event] = sink.events();
    expect(event?.success).toBe(true);
    expect(event?.durationMs).toBe(150);
    expect(event?.metadata?.["backend"]).toBe("webgpu");
    expect(event?.action).toBe("renderer.initialize");
  });

  it("measured emits failure envelope and rethrows", async () => {
    const sink = memorySink();
    const o = makeObservability({ sinks: [sink], source: "sketch" });

    await expect(
      o.measured({ component: "video", action: "video.activate" }, undefined, async () => {
        throw new Error("decode failed");
      }),
    ).rejects.toThrow("decode failed");

    const [event] = sink.events();
    expect(event?.success).toBe(false);
    expect(event?.error).toBe("decode failed");
    expect(event?.level).toBe("error");
  });

  it("dead-letters contract violations so bad events never pollute sinks", async () => {
    const sink = memorySink();
    const o = makeObservability({ sinks: [sink], source: "sketch" });

    await o.emit({ level: "info", source: "sketch", component: "c", action: "nope", success: false, error: "" } as never);

    expect(sink.events().length).toBe(0);
    expect(o.deadLetters().length).toBe(1);
  });
});

function testEmit(action: string) {
  return { level: "info" as const, source: "sketch", component: "webgpu-renderer", action, success: true };
}
