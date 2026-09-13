import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineConfig, type Plugin } from "vite";

/**
 * videos/ at the workspace root is the single authority for source clips.
 * This plugin copies them into public/videos at dev-server start and build
 * time so the shipped app serves exactly what the catalog hashes — no
 * hand-placed duplicates.
 */
function projectVideos(): Plugin {
  const from = join(__dirname, "..", "..", "videos");
  const to = join(__dirname, "public", "videos");
  return {
    name: "project-videos",
    buildStart() {
      mkdirSync(to, { recursive: true });
      for (const file of readdirSync(from)) {
        if (file.endsWith(".mp4")) {
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
