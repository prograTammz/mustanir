import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import { hydrate } from "./lib/store.js";

// Paint from what this phone already knows (IndexedDB) before the first frame; the network catches up after.
hydrate().catch(() => {}).finally(() => createRoot(document.getElementById("root")).render(<StrictMode><App /></StrictMode>));

// Offline shell and updates: a new version installs quietly in the background and waits for you to tap "Update".
if ("serviceWorker" in navigator) {
  addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      const offer = (w) => dispatchEvent(new CustomEvent("mustanir:update", { detail: () => w.postMessage("SKIP_WAITING") }));
      if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) offer(w); });
      });
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (!reloading) { reloading = true; location.reload(); } });
      // Opening the app from the home screen checks for a new version.
      document.addEventListener("visibilitychange", () => { if (!document.hidden) reg.update().catch(() => {}); });
    } catch { /* no service worker: the app still works online */ }
  });
}
// iOS Safari only runs :active (the buttons' press morph and state layer) once a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });
// Ask the browser to keep this app's storage (offline log, outbox) even under storage pressure.
navigator.storage?.persist?.().catch(() => {});
