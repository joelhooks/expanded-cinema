import { sketchEvents } from "./o11y";

/**
 * Live gallery store: the page reads content/current.json through the
 * /archive gateway at runtime. A new study becomes live by moving the
 * pointer in R2 — the already-open tab hot-swaps without a redeploy.
 * (The MCP write surface that moves the pointer is gated on owner sign-off;
 * this module only reads.)
 */

export interface CurrentStudy {
  study: string;
  sha: string;
  updatedAt: string;
  url: string;
  archive: string;
}

const STORE_URL = "/archive/content/current.json";
export const POLL_INTERVAL_MS = 60_000;

export async function fetchCurrent(): Promise<CurrentStudy | null> {
  try {
    const res = await fetch(STORE_URL, { cache: "no-store" });
    if (!res.ok) return null;
    const body = (await res.json()) as CurrentStudy;
    if (!body?.study || !body?.sha) return null;
    return body;
  } catch {
    return null;
  }
}

/** Long-running poller: fires onChange only when study@sha actually changes. */
export function watchCurrent(
  initial: CurrentStudy,
  onChange: (next: CurrentStudy, previous: CurrentStudy) => void,
): () => void {
  let current = initial;
  const id = window.setInterval(() => {
    void fetchCurrent().then((next) => {
      if (!next || next === current) return;
      if (next.study === current.study && next.sha === current.sha) return;
      const previous = current;
      current = next;
      onChange(next, previous);
      void sketchEvents
        .emitInfo("gallery", "gallery.study.swapped", {
          from: `${previous.study}@${previous.sha.slice(0, 7)}`,
          to: `${next.study}@${next.sha.slice(0, 7)}`,
        })
        .catch(() => undefined);
    });
  }, POLL_INTERVAL_MS);
  return () => window.clearInterval(id);
}
