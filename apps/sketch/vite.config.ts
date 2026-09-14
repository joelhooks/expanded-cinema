import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * The copy allowlist is DERIVED from study modules' VIDEO declarations
 * (apps/sketch/src/lib/study-*.ts) plus the boot starter. Bringing a clip
 * into the app = a study module declaring it. Source pulls in videos/
 * (gitignored, cataloged for provenance) never bundle, no matter their
 * size: the AD seq-16 AssetTooLargeError class is structurally defined
 * away, and the catalog remains pure provenance.
 */
function servedVideoNames(): Set<string> {
  const names = new Set<string>(["starter.mp4"]);
  const libDir = join(__dirname, "src", "lib");
  for (const file of readdirSync(libDir)) {
    if (!file.startsWith("study-") || !file.endsWith(".ts")) continue;
    const src = readFileSync(join(libDir, file), "utf8");
    const m = src.match(/src:\s*"(\/videos\/[^"]+)"/);
    if (m?.[1]) names.add(m[1].replace("/videos/", ""));
  }
  return names;
}

function projectVideos(): Plugin {
  const from = join(__dirname, "..", "..", "videos");
  const to = join(__dirname, "public", "videos");
  const allow = servedVideoNames();
  return {
    name: "project-videos",
    buildStart() {
      mkdirSync(to, { recursive: true });
      for (const file of readdirSync(from)) {
        if (file.endsWith(".mp4") && allow.has(file)) {
          copyFileSync(join(from, file), join(to, file));
        }
      }
    },
  };
}

export default defineConfig({
  base: "./",
  plugins: [projectVideos()],
  build: {
    outDir: "dist",
    sourcemap: true,
    target: "esnext",
  },
});
