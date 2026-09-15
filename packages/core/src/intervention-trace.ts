/**
 * Durable intervention trace for split-surface studies (clock-04 lineage),
 * per the 2026-09-14 dream-direction check (critiques/clock-03.md): a
 * viewer must be able to tell source, retained past, and a JUST-HAPPENED
 * pointer cut apart without a caption — so the intervention cannot vanish
 * in 700ms. The displaced surface holds a rest state for a bounded window
 * after an intervention, then an eased decay restores it.
 *
 * Pure domain logic; the study layer owns geometry and rendering.
 */

/** How long a displaced surface holds its rest state after an intervention (ms). */
export const TRACE_HOLD_MS = 6000;

/** Duration of the eased decay ramp after the hold (ms). */
export const TRACE_DECAY_MS = 2000;

/** Exponent of the ease used during the decay ramp. 1 = linear, 2 = quad out. */
export const TRACE_DECAY_EASE = 2;

export interface TraceEvent {
  /** Wall-clock ms of the intervention. */
  readonly at: number;
}

export interface TraceState {
  /**
   * 1 = fully displaced (rest state, intervention legible), 0 = fully
   * restored. Between: the eased decay ramp.
   */
  readonly displacement: number;
  /** True while the displacement is at/near rest (intervention legible). */
  readonly legible: boolean;
}

/**
 * Current trace state given the latest intervention and wall-clock `now`.
 * The latest event wins; superseded events are irrelevant. No event or a
 * fully-decayed history means displacement 0.
 */
export function traceState(
  latest: TraceEvent | null,
  now: number,
  holdMs = TRACE_HOLD_MS,
  decayMs = TRACE_DECAY_MS,
  ease = TRACE_DECAY_EASE
): TraceState {
  if (!latest || now < latest.at) {
    return { displacement: 0, legible: false };
  }
  const since = now - latest.at;
  if (since <= holdMs) {
    return { displacement: 1, legible: true };
  }
  const t = (since - holdMs) / decayMs;
  if (t >= 1) {
    return { displacement: 0, legible: false };
  }
  const eased = (1 - t) ** ease;
  return { displacement: eased, legible: t < 0.2 };
}
