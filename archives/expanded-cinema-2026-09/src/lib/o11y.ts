/**
 * Browser composition of the o11y contract: window ring (agent-inspectable)
 * + structured console. Every boundary here emits through `otel`, never
 * console.log.
 */
import {
  consoleSink,
  makeObservability,
  windowRingSink,
  type Observability,
} from "@expanded-cinema/core";

let singleton: Observability | null = null;

export function otel(): Observability {
  singleton ??= makeObservability({
    source: "sketch",
    sinks: [windowRingSink(), consoleSink()],
  });
  return singleton;
}

/**
 * Event-per-hop helpers the sketch surfaces call directly. Kept tiny so the
 * call sites read like sentences.
 */
export const sketchEvents = {
  async measured<T>(
    component: string,
    action: string,
    metadata: Record<string, unknown> | undefined,
    operation: () => Promise<T>,
  ): Promise<T> {
    return otel().measured({ component, action }, metadata, operation);
  },
  async emitFailure(component: string, action: string, error: string, metadata?: Record<string, unknown>): Promise<void> {
    await otel().emit({
      level: "error",
      source: "sketch",
      component,
      action,
      success: false,
      error,
      ...(metadata !== undefined ? { metadata } : {}),
    });
  },
  async emitInfo(component: string, action: string, metadata?: Record<string, unknown>): Promise<void> {
    await otel().emit({
      level: "info",
      source: "sketch",
      component,
      action,
      success: true,
      ...(metadata !== undefined ? { metadata } : {}),
    });
  },
};

/** Reads the live ring buffer; the daily agent calls this, not console soup. */
export function recentEvents(limit = 12): readonly string[] {
  const w = window as { __expandedCinemaOtel?: { events(): readonly unknown[] } };
  const events = w.__expandedCinemaOtel?.events() ?? [];
  return events
    .slice(-limit)
    .map((event) => {
      const ev = event as {
        time: string;
        level: string;
        component: string;
        action: string;
        success: boolean;
        durationMs?: number;
      };
      return `${ev.time.slice(11, 19)} ${ev.level} ${ev.component}.${ev.action}${
        ev.success ? "" : " ✗"
      }${ev.durationMs !== undefined ? ` ${ev.durationMs}ms` : ""}`;
    });
}

export function otelOnce(): Observability {
  return otel();
}
