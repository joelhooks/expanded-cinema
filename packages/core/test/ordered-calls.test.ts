import { describe, expect, it } from "vitest";

import { Sequencer } from "../src/ordered-calls";

function collect(): { seq: Sequencer<number>; out: number[] } {
  const out: number[] = [];
  return { out, seq: new Sequencer<number>((v) => out.push(v)) };
}

describe("Sequencer", () => {
  it("delivers in order when submissions are in order", () => {
    const { seq, out } = collect();
    seq.submit(0, 10);
    seq.submit(1, 11);
    seq.submit(2, 12);
    expect(out).toEqual([10, 11, 12]);
  });

  it("holds one future frame and delivers it after the gap fills", () => {
    const { seq, out } = collect();
    seq.submit(0, 10);
    seq.submit(2, 12); // future: held
    expect(out).toEqual([10]);
    seq.submit(1, 11); // fills the gap; 11 then 12 drain
    expect(out).toEqual([10, 11, 12]);
  });

  it("drops stale submissions (frame already delivered)", () => {
    const { seq, out } = collect();
    seq.submit(0, 10);
    seq.submit(0, 99); // stale
    seq.submit(1, 11);
    expect(out).toEqual([10, 11]);
  });

  it("replaces a held same-index submission with the newest (ring semantics)", () => {
    const { seq, out } = collect();
    seq.submit(0, 10);
    seq.submit(2, 12);
    seq.submit(2, 22); // newest truth for frame 2
    seq.submit(1, 11);
    expect(out).toEqual([10, 11, 22]);
  });

  it("ignores submissions beyond next+1 (drop far-future, newest wins later)", () => {
    const { seq, out } = collect();
    seq.submit(0, 10);
    seq.submit(5, 15); // too far ahead; dropped — a later nearer submit wins
    seq.submit(1, 11);
    seq.submit(2, 12);
    expect(out).toEqual([10, 11, 12]);
  });
});
