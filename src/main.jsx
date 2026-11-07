import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";
import ErrorBoundary from "./components/ErrorBoundary.jsx";
import { hydrate } from "./lib/store.js";
import { play } from "./lib/sound.js";
import { haptic, installTapHaptics } from "./components/m3/index.jsx";
import { initUpdates } from "./lib/update.js";

// Paint from what this phone already knows (IndexedDB) before the first frame; the network catches up after.
hydrate().catch(() => {}).finally(() => createRoot(document.getElementById("root")).render(<StrictMode><ErrorBoundary><App /></ErrorBoundary></StrictMode>));

// Offline shell and numbered updates: downloaded quietly, put in place when you leave the app (see src/lib/update.js).
initUpdates();
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
