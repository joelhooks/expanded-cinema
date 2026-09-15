import { describe, expect, it } from "vitest";

describe("core", () => {
  it("classifies orchestration-only sources without a video", async () => {
    const { classify } = await import("../src/lib/video-catalog");
    expect(classify("projector-lockup.mp4")).toEqual({
      mode: "orchestration-only",
      video: null,
    });
  });

  it("classifies direct-play sources with a video", async () => {
    const { classify } = await import("../src/lib/video-catalog");
    expect(classify("hud-loop.mp4")).toEqual({
      mode: "direct-play",
      video: "/videos/hud-loop.mp4",
    });
  });

  it("classifies gpu-readback sources with a video", async () => {
    const { classify } = await import("../src/lib/video-catalog");
    expect(classify("glitch-pass.mp4")).toEqual({
      mode: "gpu-readback",
      video: "/videos/glitch-pass.mp4",
    });
  });
});
