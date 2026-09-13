import { makeEvent, validateEvent, type OtelEvent } from "./event";
import type { EventSink } from "./sinks";

export interface EmitInput {
  readonly level: OtelEvent["level"];
  readonly source: string;
  readonly component: string;
  readonly action: string;
  readonly success?: boolean;
  readonly error?: string;
  readonly durationMs?: number;
  readonly metadata?: Readonly<Record<string, unknown>>;
}

export interface MeasuredAction {
  readonly component: string;
  readonly action: string;
  readonly source?: string;
  readonly level?: OtelEvent["level"];
}

export interface Observability {
  /** Validates then fans out to every sink; invalid events land on dead-letter. */
  emit(input: EmitInput): Promise<void>;
  /**
   * Times an async operation and emits one completion event per hop —
   * success and failure envelopes included, duration always present.
   */
  measured<T>(
    action: MeasuredAction,
    metadata: Readonly<Record<string, unknown>> | undefined,
    operation: () => Promise<T>,
  ): Promise<T>;
  /** Events rejected by validation or by a sink; inspect in tests/probes. */
  deadLetters(): readonly OtelEvent[];
}

export interface ObservabilityOptions {
  readonly sinks: readonly EventSink[];
  readonly source: string;
  /** Test seam; defaults to real time. */
  readonly now?: () => number;
}

export function makeObservability(options: ObservabilityOptions): Observability {
  const dead: OtelEvent[] = [];

  return {
    async emit(input): Promise<void> {
      const event = makeEvent({
        level: input.level,
        source: input.source ?? options.source,
        component: input.component,
        action: input.action,
        success: input.success ?? true,
        ...(input.error !== undefined ? { error: input.error } : {}),
        ...(input.durationMs !== undefined ? { durationMs: input.durationMs } : {}),
        ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
      });
      const validation = validateEvent(event);
      if (!validation.ok) {
        dead.push({
          ...event,
          metadata: { ...event.metadata, validationProblems: validation.problems },
        });
        return;
      }
      for (const sink of options.sinks) {
        const rejection = await sink.write(event);
        if (rejection !== null) {
          dead.push({
            ...event,
            metadata: { ...event.metadata, sink: sink.name, sinkError: rejection },
          });
        }
      }
    },

    async measured<T>(
      action: MeasuredAction,
      metadata: Readonly<Record<string, unknown>> | undefined,
      operation: () => Promise<T>,
    ): Promise<T> {
      const start = (options.now ?? Date.now)();
      try {
        const result = await operation();
        await this.emit({
          level: action.level ?? "info",
          source: action.source ?? options.source,
          component: action.component,
          action: action.action,
          success: true,
          durationMs: (options.now ?? Date.now)() - start,
          ...(metadata !== undefined ? { metadata } : {}),
        });
        return result;
      } catch (caught) {
        await this.emit({
          level: action.level ?? "error",
          source: action.source ?? options.source,
          component: action.component,
          action: action.action,
          success: false,
          error: caught instanceof Error ? caught.message : String(caught),
          durationMs: (options.now ?? Date.now)() - start,
          ...(metadata !== undefined ? { metadata } : {}),
        });
        throw caught;
      }
    },

    deadLetters: () => [...dead],
  };
}
