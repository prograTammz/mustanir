import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "node:path";
import fs from "node:fs";

// Fills the service worker with this build's id and the list of files to keep offline.
function precache(): Plugin {
  return {
    name: "mustanir-precache",
    apply: "build",
    closeBundle() {
      const out = path.resolve(__dirname, "dist"), sw = path.join(out, "sw.js");
      if (!fs.existsSync(sw)) return;
      const files: string[] = [];
      const walk = (d: string) => { for (const f of fs.readdirSync(d)) { const p = path.join(d, f); if (fs.statSync(p).isDirectory()) walk(p); else files.push(path.relative(out, p).split(path.sep).join("/")); } };
      walk(out);
      // Launch images and store screenshots are fetched by iOS / the install sheet directly, not by the app.
      const keep = files.filter((f) => !/^(sw\.js|CNAME|splash\/|screenshots\/)/.test(f) && f !== "index.html").map((f) => "./" + f);
      const id = Date.now().toString(36);
      fs.writeFileSync(sw, fs.readFileSync(sw, "utf8").replace("__BUILD__", id).replace("self.__PRECACHE || []", JSON.stringify(keep)));
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), precache()],
  base: "./",
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  // Modern targets only (iOS 16.4+ is the floor for web push anyway): smaller output, no legacy transforms.
  build: { outDir: "dist", sourcemap: false, target: "es2022", cssMinify: "lightningcss", chunkSizeWarningLimit: 300,
    // React in its own long-lived chunk: an app update doesn't make the phone re-download React.
    rollupOptions: { output: { manualChunks: { react: ["react", "react-dom", "react/jsx-runtime"] } } } },
});
