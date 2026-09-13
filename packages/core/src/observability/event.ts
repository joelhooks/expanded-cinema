/**
 * Canonical event contract for expanded-cinema.
 *
 * Shape mirrors the joelclaw wide-event contract (source/component/action/
 * success/metadata/duration_ms) so habits transfer across projects. High
 * cardinality values (ids, urls, hashes) belong in `metadata`, never in the
 * facet fields. Structured events are the source of truth; console output is
 * a sink, never the ledger.
 */

export type EventLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface OtelEvent {
  /** ISO 8601 timestamp of emission. */
  readonly time: string;
  readonly level: EventLevel;
  /** Subsystem: `sketch`, `pipeline`, `render`, `video`, `deploy`, … */
  readonly source: string;
  /** Stable module/service name (e.g. `webgpu-renderer`). */
  readonly component: string;
  /** Stable dotted action (e.g. `renderer.initialize`). */
  readonly action: string;
  /** False means the operation failed; `error` must be meaningful. */
  readonly success: boolean;
  /** Human/mechanical readable failure reason; required when success is false. */
  readonly error?: string;
  /** Wall-clock duration for timed operations. */
  readonly durationMs?: number;
  /** High cardinality context: ids, urls, hashes, counts, stats. */
  readonly metadata?: Readonly<Record<string, unknown>>;
}

const LEVELS: ReadonlySet<string> = new Set(["debug", "info", "warn", "error", "fatal"]);

export interface ValidationResult {
  readonly ok: boolean;
  readonly problems: readonly string[];
}

/**
 * Validates the invariants the contract calls non-negotiable. Returns all
 * problems at once so a bad emitter fails loudly, not once per field.
 */
export function validateEvent(event: OtelEvent): ValidationResult {
  const problems: string[] = [];
  if (!LEVELS.has(event.level)) {
    problems.push(`level: unknown "${event.level}"`);
  }
  if (event.source.trim() === "") {
    problems.push("source: empty");
  }
  if (event.component.trim() === "") {
    problems.push("component: empty");
  }
  if (event.action.trim() === "" || !/^[a-z][a-z0-9_.]*$/.test(event.action)) {
    problems.push(`action: must be dotted lowercase, got "${event.action}"`);
  }
  if (!event.success && (event.error === undefined || event.error.trim() === "")) {
    problems.push("error: required when success is false");
  }
  if (
    event.durationMs !== undefined &&
    (!Number.isFinite(event.durationMs) || event.durationMs < 0)
  ) {
    problems.push(
      `durationMs: must be a finite non-negative number, got ${event.durationMs}`,
    );
  }
  if (event.success && event.level === "error" && event.metadata?.["handled"] !== true) {
    problems.push("level error without success:false is ambiguous");
  }
  return { ok: problems.length === 0, problems };
}

export function makeEvent(input: Omit<OtelEvent, "time"> & { time?: string }): OtelEvent {
  return { time: input.time ?? new Date().toISOString(), ...input } as OtelEvent;
}
