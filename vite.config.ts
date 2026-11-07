import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
// @ts-ignore: a plain ES module, shared with CI (see its header)
import { describeRelease, devRelease, slim } from "./scripts/release.mjs";

// The release this build is (scripts/release.mjs), baked in three places:
//   - __RELEASE__ in the app: what's running, even offline;
//   - virtual:release-history for Settings: the notes of past releases;
//   - dist/sw.js, with the list of files to keep offline, and dist/version.json, for "Check for updates" to read what's live.
// The worker's build id hashes the built files, so a rebuild of the same release (a docs-only push) is byte-identical and
// phones download nothing.
function release(): Plugin {
  let rel: any, building = false;
  const HISTORY = "virtual:release-history";
  return {
    name: "mustanir-release",
    async config(_, env) {
      building = env.command === "build";
      rel = await describeRelease({ cwd: __dirname }).catch((e: Error) => { console.warn(`[release] ${e.message}: building as dev`); return devRelease(); });
      const { number, version, sha, date, notes, urgent, minimum, channel } = rel;
      return { define: { __RELEASE__: JSON.stringify({ number, version, sha: String(sha).slice(0, 7), date, notes, urgent, minimum, channel }) } };
    },
    buildStart() { if (rel.number) this.info(`Update ${rel.number} (v${rel.version}, ${rel.fresh ? "new" : "unchanged"}, ${rel.channel})`); },
    resolveId: (id) => (id === HISTORY ? "\0" + HISTORY : null),
    load: (id) => (id === "\0" + HISTORY ? `export default ${JSON.stringify(rel.history)};` : null),
    closeBundle() {
      const out = path.resolve(__dirname, "dist"), sw = path.join(out, "sw.js");
      if (!building || !fs.existsSync(sw)) return;
      const files: string[] = [];
      const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(out, p).split(path.sep).join("/")); } };
      walk(out);
      files.sort();
      // Launch images and store screenshots are fetched by iOS / the install sheet directly, not by the app.
      const keep = files.filter((f) => !/^(sw\.js|version\.json|CNAME|splash\/|screenshots\/)/.test(f) && f !== "index.html");
      const hash = crypto.createHash("sha256");
      for (const f of [...keep, "index.html"]) hash.update(f).update(fs.readFileSync(path.join(out, f)));
      const build = `r${rel.number}-${hash.digest("hex").slice(0, 10)}`;
      const worker = { ...slim(rel), minimum: rel.minimum, build };
      fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace("__BUILD__", build).replace("self.__PRECACHE || []", JSON.stringify(keep.map((f) => "./" + f))).replace("self.__RELEASE || null", JSON.stringify(worker)));
      // What's live. `items`, `tag`, `sha`, `fresh` and `previous` are for CI's release step; the app reads the rest.
      const { history, ...current } = rel;
      fs.writeFileSync(path.join(out, "version.json"), JSON.stringify({ ...current, build, history }, null, 1) + "\n");
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), release()],
  base: "./",
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Modern targets only (iOS 16.4+ is the floor for web push anyway): smaller output, no legacy transforms.
  build: { outDir: "dist", sourcemap: false, target: "es2022", cssMinify: "lightningcss", chunkSizeWarningLimit: 300,
    // React in its own long-lived chunk: an app update doesn't make the phone re-download React.
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react/jsx-runtime"] } } } },
});
