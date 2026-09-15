/**
 * Monotonic ordering guard for async callbacks feeding a sequential
 * detector. WebGPU's readRenderTargetPixelsAsync resolves out of order
 * under load; CutDetector expects push() in frame order or it reports
 * false cuts. `Sequencer` accepts a frame index with the payload and
 * invokes the handler only on the next expected frame, holding (and
 * replacing) late arrivals — stale payloads are dropped, matching the
 * ring-capture semantics: the newest presented frame is the truth.
 *
 * Pure domain logic; no timing, no DOM.
 */

export class Sequencer<T> {
  private next = 0;
  private held: { index: number; value: T } | null = null;
  private readonly handle: (value: T) => void;

  constructor(handle: (value: T) => void) {
    this.handle = handle;
  }

  /** Submit payload for frame index; invokes handle() in order, skipping gaps. */
  submit(index: number, value: T): void {
    if (index < this.next) {
      return;
    } // stale
    if (index === this.held?.index) {
      this.held.value = value; // replace held same-frame value with newest
      return;
    }
    if (index === this.next) {
      this.handle(value);
      this.next += 1;
      // drain held subsequent frames
      while (this.held && this.held.index === this.next) {
        this.handle(this.held.value);
        this.next += 1;
        this.held = null;
      }
      return;
    }
    // future index: hold only if it's the immediate next expected
    if (index === this.next + 1) {
      this.held = { index, value };
    }
  }
}
