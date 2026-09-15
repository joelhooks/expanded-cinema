import { create } from "zustand";

export type Lifecycle = "idle" | "discovering" | "ready" | "active" | "playing" | "failed";

interface VideoLayerState {
  lifecycle: Lifecycle;
  enabled: boolean;
  currentSrc: string | null;
  currentHash: string | null;
  failureCount: number;
  lastError: string | null;
  start: () => void;
  discover: () => void;
  ready: () => void;
  activate: (src: string, hash: string | null) => void;
  play: () => void;
  fail: (error: string) => void;
  toggleEnabled: () => void;
  hideOverlay: () => void;
}

const initialSource = {
  // INGEST keeps the loop deterministic: a single starter clip baked into
  // apps/sketch/public/videos/starter.mp4 until the daily pipeline promotes
  // richer sources into the loop.
  src: "/videos/starter.mp4",
  hash: "1f0e3a5c2b98e7a1156c4d2f9b7a4c0e8d3f6b2a9c5e1d740f83b6a29ec51d74",
};

function failMessage(error: unknown): string {
  if (typeof error === "string") {
    return error;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown video pipeline error";
}

export const useVideoLayerState = create<VideoLayerState>()((set) => ({
  lifecycle: "idle",
  enabled: true,
  currentSrc: null,
  currentHash: null,
  failureCount: 0,
  lastError: null,
  start: () =>
    set((state) => (state.lifecycle === "idle" ? { lifecycle: "discovering" } : state)),
  discover: () =>
    set((state) => (state.lifecycle === "idle" ? { lifecycle: "discovering" } : state)),
  ready: () =>
    set((state) => (state.lifecycle === "discovering" ? { lifecycle: "ready" } : state)),
  activate: (src, hash) =>
    set({ lifecycle: "active", currentSrc: src, currentHash: hash, lastError: null }),
  play: () => set({ lifecycle: "playing" }),
  fail: (error) =>
    set((state) => ({
      lifecycle: "failed",
      lastError: failMessage(error),
      failureCount: state.failureCount + 1,
    })),
  toggleEnabled: () => set((state) => ({ enabled: !state.enabled })),
  hideOverlay: () => set({ lastError: null }),
}));
