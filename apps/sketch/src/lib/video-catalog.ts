import catalogJson from "../../catalog.json";

export interface CatalogEntry {
  file: string;
  sha256: string | null;
}

export interface CatalogDocument {
  generatedAt: string;
  generator: string;
  entries: CatalogEntry[];
}

export const catalog = catalogJson as unknown as CatalogDocument;

/**
 * Normalizes a catalog file path into the web URL the Vite dev server and
 * production Express effect both serve. Paths in the catalog are relative to
 * the workspace root's `videos` directory.
 */
export function catalogUrl(file: string): string {
  const clean = file.replace(/^\/+/, "");
  return `/videos/${encodeURI(clean)}`;
}

export type SourceMode = "direct-play" | "gpu-readback" | "orchestration-only";

export interface SourceClassification {
  mode: SourceMode;
  video: string | null;
}

/**
 * Single deterministic classification per entry, applied uniformly so no
 * special-casing can creep into the loop. Filename suffixes are the contract:
 * - *.mp4 (anything else): direct-play, used by both the HTMLVideoElement and
 *   the grouped WebGPU video reader
 * - *.readback.mp4: also direct-play, marked as a gpu-readback study input
 * - *.orchestration.mp4: orchestration-only, suppressed from the loop
 */
export function classify(file: string): SourceClassification {
  if (file.endsWith(".orchestration.mp4")) {
    return { mode: "orchestration-only", video: null };
  }
  if (file.endsWith(".readback.mp4")) {
    return { mode: "gpu-readback", video: catalogUrl(file) };
  }
  return { mode: "direct-play", video: catalogUrl(file) };
}

export interface CatalogSource {
  file: string;
  hash: string | null;
  classification: SourceClassification;
}

/**
 * Sorted (stable) known sources for the loop — orchestration-only entries are
 * excluded so the pipeline never schedules what it cannot play.
 */
export function knownSources(): CatalogSource[] {
  return [...catalog.entries]
    .sort((a, b) => a.file.localeCompare(b.file))
    .map((entry) => ({
      file: entry.file,
      hash: entry.sha256,
      classification: classify(entry.file),
    }))
    .filter((source) => source.classification.video !== null);
}
