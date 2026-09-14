/**
 * Shared domain logic for the expanded cinema loop. Video layer sequencing
 * lives here so apps/sketch stays a thin composition root.
 */

export * from "./observability";
export interface SourceRef {
  file: string;
  hash: string | null;
}

export interface LoopOrder {
  readonly sources: readonly SourceRef[];
}

/**
 * Rotates deterministically through sources in sorted order. The loop is a
 * stepping stone: the daily pipeline will replace rotation with questions.
 */
export function rotate(sources: readonly SourceRef[], index: number): SourceRef | null {
  if (sources.length === 0) {
    return null;
  }
  const i = ((index % sources.length) + sources.length) % sources.length;
  return sources[i] ?? null;
}

export * from "./cut-detection";
