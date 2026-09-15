import type { OtelEvent } from "./event";

declare global {
  interface Window {
    __expandedCinemaOtel?: { events(): readonly OtelEvent[] };
  }
}

/**
 * A sink receives validated events. Sinks must never throw — a telemetry
 * failure must not take the sketch down. `write` returns a rejection reason
 * instead of raising.
 */
export interface EventSink {
  readonly name: string;
  write(event: OtelEvent): Promise<string | null>;
}

/** Keeps the most recent `capacity` events in memory for tests and agents. */
export function memorySink(
  capacity = 256
): EventSink & { events(): readonly OtelEvent[] } {
  const buffer: OtelEvent[] = [];
  return {
    events: () => [...buffer],
    name: "memory",
    // eslint-disable-next-line @typescript-eslint/require-await -- sync sink: no async body exists to await; promise-function-async (interface style) requires async.
    async write(event) {
      buffer.push(event);
      if (buffer.length > capacity) {
        buffer.shift();
      }
      return null;
    },
  };
}

/** Structured console sink: one JSON line per event, never string soup. */
export function consoleSink(): EventSink {
  return {
    name: "console",
    // eslint-disable-next-line @typescript-eslint/require-await -- sync sink: no async body exists to await; promise-function-async (interface style) requires async.
    async write(event) {
      console.info(JSON.stringify(event));
      return null;
    },
  };
}

/**
 * Ring buffer that also installs itself on `globalThis` under a stable name
 * so the daily agent can inspect real runtime telemetry in the page — visual
 * critique backed by events, not vibes.
 */
export function windowRingSink(
  capacity = 512
): EventSink & { events(): readonly OtelEvent[] } {
  const buffer: OtelEvent[] = [];
  const sink: EventSink & { events(): readonly OtelEvent[] } = {
    events: () => [...buffer],
    name: "window-ring",
    // eslint-disable-next-line @typescript-eslint/require-await -- sync sink: no async body exists to await; promise-function-async (interface style) requires async.
    async write(event) {
      buffer.push(event);
      if (buffer.length > capacity) {
        buffer.shift();
      }
      return null;
    },
  };
  if (typeof window !== "undefined") {
    window.__expandedCinemaOtel = { events: () => sink.events() };
  }
  return sink;
}
