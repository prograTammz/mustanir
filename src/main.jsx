import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { hydrate } from "./lib/store.js";
import { play } from "./lib/sound.js";
import { haptic, installTapHaptics } from "./components/m3/index.jsx";

// Paint from what this phone already knows (IndexedDB) before the first frame; the network catches up after.
hydrate().catch(() => {}).finally(() => createRoot(document.getElementById("root")).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>));

// Offline shell and updates. A new version downloads quietly while you use the app and takes over out of sight: when the app
// goes to the background, or as it opens with one already waiting. The browser's own rule, swap once every window is closed,
// isn't enough: iOS keeps a home-screen app paused in the background rather than closing it, so an update could wait for days.
// Not while a text field has focus, though: a note that saves on blur would be lost.
// The swap can stall 10 to 30 s behind the old worker after a load (tested), so it may land once you're using the app again.
// Then the reload waits until you next leave; the old page runs safely meanwhile, as every screen's code loads at startup.
if ("serviceWorker" in navigator) {
  addEventListener("load", async () => {
    try {
      const reg = await navigator.serviceWorker.register("sw.js");
      let reloading = false, pending = false, shownAt = performance.now();
      const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
      // Out of sight, or in the first moments after the app opens or comes back: reload now. Otherwise when you next leave.
      navigator.serviceWorker.addEventListener("controllerchange", () => { if (document.hidden || performance.now() - shownAt < 3000) reload(); else pending = true; });
      const typing = () => !!document.activeElement?.matches?.('textarea, [contenteditable], input:not([type="checkbox"]):not([type="radio"])');
      const swap = () => { if (reg.waiting && navigator.serviceWorker.controller && !typing()) reg.waiting.postMessage("SKIP_WAITING"); };
      // One that finishes downloading after you've left takes over then.
      reg.addEventListener("updatefound", () => {
        const w = reg.installing;
        w?.addEventListener("statechange", () => { if (w.state === "installed" && document.hidden) swap(); });
      });
      // Leaving the app puts a waiting version in place (or reloads into one already there); coming back checks for a new one.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { if (pending && !typing()) reload(); else swap(); }
        else { shownAt = performance.now(); reg.update().catch(() => {}); }
      });
      swap(); // one that came down last time takes over as the app opens
    } catch { /* no service worker: the app still works online */ }
  });
}
// Every control answers a real tap, with a tick under the finger and a soft click.
const CONTROL = 'button, a[href], select, [role="button"], [role="switch"], [role="checkbox"], [role="radio"], input[type="checkbox"], input[type="radio"]';
document.addEventListener("click", (e) => { if (e.isTrusted && !e.target.matches?.("input[switch]") && e.target.closest?.(CONTROL)) { haptic(); play("tap"); } }, true);
installTapHaptics();
// Long-press is not a browser gesture here, outside the fields you type in (Android asks through this event; iOS through CSS).
if (matchMedia("(pointer: coarse)").matches) document.addEventListener("contextmenu", (e) => { if (!e.target.closest?.("input, textarea")) e.preventDefault(); });
history.scrollRestoration = "manual"; // like a native app, it opens at the top rather than where a past visit left it
// iOS Safari only runs :active (the buttons' press morph and state layer) once a touch listener exists.
document.addEventListener("touchstart", () => {}, { passive: true });
// Ask the browser to keep this app's storage (offline log, outbox) even under storage pressure.
navigator.storage?.persist?.().catch(() => {});
