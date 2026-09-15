/**
 * Ring-capture indexing for same-view delay capture (clock-02 lineage).
 * The canvas writes the CURRENT frame into ring slot n % length, and every
 * reader samples the frame DELAY steps behind: slot (n - DELAY) % length.
 * The ring length MUST be DELAY + 1 — the same-scope write/read fix that
 * unblocked recurrence-01 (map-before-write ordering lives in the study
 * layer; this module owns only the arithmetic).
 *
 * Pure domain logic; the study layer owns targets and rendering.
 */

export interface RingPlan {
  /** Frames of lag between the live surface and the past surface. */
  readonly delay: number;
}

/** The ring length a delay requires: delay + 1 (write slot excluded). */
export function ringLength(delay: number): number {
  if (delay < 0 || !Number.isInteger(delay)) {
    throw new Error(`delay must be a non-negative integer, got ${delay}`);
  }
  return delay + 1;
}

/** Write slot for frame count n. */
export function writeSlot(n: number, length: number): number {
  checkLength(length);
  return mod(n, length);
}

/** Read slot for frame count n sampling `delay` frames behind. */
export function readSlot(n: number, delay: number, length: number): number {
  checkLength(length);
  if (delay < 0 || !Number.isInteger(delay)) {
    throw new Error(`delay must be a non-negative integer, got ${delay}`);
  }
  return mod(n - delay, length);
}

/**
 * True when the reader at frame n samples a slot that the writer will
 * overwrite this same frame — the same-scope violation class of the
 * recurrence-01 black screen. length = delay + 1 always answers false.
 */
export function isSameScopeCollision(
  n: number,
  delay: number,
  length: number
): boolean {
  return readSlot(n, delay, length) === writeSlot(n, length);
}

function mod(a: number, b: number): number {
  return ((a % b) + b) % b;
}

function checkLength(length: number): void {
  if (length < 1 || !Number.isInteger(length)) {
    throw new Error(`length must be a positive integer, got ${length}`);
  }
}
