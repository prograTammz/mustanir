// App updates: which release is running, what's waiting, and the "Check for updates" in Settings.
//
// Every deploy that changes the app is a numbered release (scripts/release.mjs). A new one downloads quietly while you
// use the app and takes over out of sight: when the app goes to the background, or as it opens with one waiting. The
// browser's own rule, swap once every window is closed, isn't enough on iPhone: iOS keeps a home-screen app paused in the
// background rather than closing it, so an update could wait for days. Never while a text field has focus (a note that
// saves on blur would be lost).
//
// The swap can stall 10 to 30 s behind the old worker after a load (tested on iOS), so it may land once you're using the
// app again. Then the reload waits until you next leave; the old page runs safely meanwhile, as every screen's code loads
// at startup. Two exceptions reload sooner: you tapped "Restart now", or the release is urgent (`Update: urgent` in a
// commit), meaning the running one is below the new release's minimum.
//
// What iOS needs beyond that, all handled here:
//   - checks when the app comes back (visibilitychange, and pageshow for a page restored from the back-forward cache),
//     every 30 minutes while it stays open, and when the network returns, since iOS runs nothing in the background;
//   - updateViaCache "none", plus a fetch of sw.js past the HTTP cache when the live site is ahead but the browser found
//     nothing (Safari can keep comparing against a stale copy);
//   - a version handshake with the waiting worker, so "Update 16 is ready" and its notes need no network;
//   - never unregistering the worker, since that would drop the push subscription.
import { useSyncExternalStore } from "react";

/* global __RELEASE__ */
export const RELEASE = typeof __RELEASE__ === "object" && __RELEASE__ ? __RELEASE__ : { number: 0, version: "dev", notes: [], channel: "local", minimum: 0 };

const MIN = 60e3, HOUR = 60 * MIN;
const KEY = "a2-release";

/* ---------- state, for Settings ---------- */
// status: idle · checking · current · downloading · ready · applying · offline · stuck · error · unsupported
let st = { status: "idle", available: null, live: null, checkedAt: 0, error: "", installedAt: 0, from: 0 };
const subs = new Set();
const emit = (patch) => { st = { ...st, ...patch }; subs.forEach((f) => f()); };
export const useUpdate = () => useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => st);

// When this release reached this phone, and what it replaced: Settings marks a fresh one "New" for a few days.
function noteInstall() {
  try {
    const prev = JSON.parse(localStorage.getItem(KEY) || "null");
    if (prev && prev.number === RELEASE.number) return emit({ installedAt: prev.at, from: prev.from || 0 });
    const rec = { number: RELEASE.number, at: Date.now(), from: prev ? prev.number : 0 };
    localStorage.setItem(KEY, JSON.stringify(rec));
    emit({ installedAt: rec.at, from: rec.from });
  } catch { /* private mode: no record, no badge */ }
}

/* ---------- the worker ---------- */
let reg = null, reloading = false, pending = false, force = false, shownAt = performance.now(), lastCheck = 0, lastLive = 0;
const reload = () => { if (!reloading) { reloading = true; location.reload(); } };
const typing = () => !!document.activeElement?.matches?.('textarea, [contenteditable], input:not([type="checkbox"]):not([type="radio"])');
const urgent = (r) => !!r && (r.minimum || 0) > RELEASE.number;

// Ask the waiting worker to take over. Only with a page it controls (a first install takes over by itself).
function swap(now = false) {
  const w = reg?.waiting;
  if (!w || !navigator.serviceWorker.controller || (!now && typing())) return false;
  w.postMessage("SKIP_WAITING");
  return true;
}

// Which release a worker carries. A worker from before numbered releases doesn't answer: null.
function ask(worker, ms = 2500) {
  return new Promise((res) => {
    if (!worker) return res(null);
    const ch = new MessageChannel(), t = setTimeout(() => res(null), ms);
    ch.port1.onmessage = (e) => { clearTimeout(t); res(e.data && e.data.number ? e.data : null); };
    try { worker.postMessage({ type: "VERSION" }, [ch.port2]); } catch { clearTimeout(t); res(null); }
  });
}

async function onWaiting() {
  const w = reg?.waiting;
  if (!w) return;
  const info = (await ask(w)) || (st.live && st.live.number > RELEASE.number ? st.live : { number: 0, notes: [] });
  if (reg.waiting !== w) return; // replaced meanwhile by a newer one
  emit({ status: "ready", available: info, checkedAt: Date.now(), error: "" });
  if (urgent(info)) { force = true; swap(); } // urgent: in place now, unless you're typing (then when you leave)
  else if (document.hidden) swap();
}

function watch(w) {
  if (!w || !navigator.serviceWorker.controller) return; // the first install: nothing to report
  if (st.status !== "checking") emit({ status: "downloading" });
  w.addEventListener("statechange", () => {
    if (w.state === "installed") onWaiting();
    else if (w.state === "redundant" && !reg?.installing && !reg?.waiting && st.status === "downloading") emit({ status: "error", error: "The download didn’t finish. It tries again when you next open the app." });
  });
}

// What's live on the site right now. null when there's no version.json (the dev server) or it couldn't be read.
async function fetchLive() {
  const r = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
  if (!r.ok) return null;
  const j = await r.json();
  lastLive = Date.now();
  return j && j.number ? { number: j.number, version: j.version, date: j.date, notes: j.notes || [], minimum: j.minimum || 0, history: j.history || [] } : null;
}

// Automatic: on coming back, every 30 minutes while open, on reconnect. Cheap: the browser compares one small file.
async function autoCheck() {
  if (!reg || reloading || Date.now() - lastCheck < MIN) return;
  lastCheck = Date.now();
  try { await reg.update(); } catch { /* offline: next time */ }
  // Every few hours, also what's live: an urgent release must not wait on a phone that holds an old sw.js.
  if (Date.now() - lastLive > 6 * HOUR) {
    const live = await fetchLive().catch(() => null);
    if (live) { emit({ live }); if (urgent(live) && live.number > RELEASE.number && !reg.waiting && !reg.installing) await refetchWorker(); }
  }
}

// Safari can keep comparing against a cached sw.js: fetch it past the HTTP cache, then ask again.
async function refetchWorker() {
  await fetch("sw.js", { cache: "reload" }).catch(() => {});
  await reg.update().catch(() => {});
}

/** The button in Settings: what's live, whether it has reached this phone, and what to do about it. */
export async function checkForUpdate() {
  if (["checking", "applying", "downloading"].includes(st.status)) return;
  if (!navigator.onLine) return emit({ status: "offline", checkedAt: Date.now() });
  emit({ status: "checking", error: "" });
  try {
    const [live] = await Promise.all([fetchLive().catch(() => null), reg?.update()]);
    lastCheck = Date.now();
    if (live) emit({ live });
    if (reg?.waiting) return onWaiting();
    if (reg?.installing) return emit({ status: "downloading" });
    if (!live || live.number <= RELEASE.number) return emit({ status: "current", available: null, checkedAt: Date.now() });
    // No worker (an in-app browser): a reload loads the newest from the network.
    if (!reg) return emit({ status: "ready", available: { ...live, reloadOnly: true }, checkedAt: Date.now() });
    await refetchWorker();
    if (reg.waiting) return onWaiting();
    if (reg.installing) return emit({ status: "downloading", available: live });
    // GitHub's edge can take a few minutes to serve a new deploy everywhere.
    emit({ status: "stuck", available: live, checkedAt: Date.now() });
  } catch (e) {
    emit({ status: navigator.onLine ? "error" : "offline", error: e?.message || String(e), checkedAt: Date.now() });
  }
}

/** "Restart now": put the waiting release in place and reload into it. */
export function applyUpdate() {
  force = true;
  if (!reg?.waiting) return reload(); // nothing to swap (no worker): the reload is the update
  emit({ status: "applying" });
  swap(true);
  setTimeout(reload, 6000); // iOS can hold the swap behind the old worker; the reloaded page gets there too
}

/** Called once from main.jsx. */
export function initUpdates() {
  noteInstall();
  if (!("serviceWorker" in navigator) || import.meta.env.DEV) return emit({ status: "unsupported" });
  addEventListener("load", async () => {
    try {
      reg = await navigator.serviceWorker.register("sw.js", { updateViaCache: "none" });
      // Out of sight, in the first moments after the app opens or comes back, or asked for: reload now. Otherwise when you next leave.
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (document.hidden || performance.now() - shownAt < 3000 || (force && !typing())) reload(); else pending = true;
      });
      reg.addEventListener("updatefound", () => watch(reg.installing));
      // Leaving the app puts a waiting version in place (or reloads into one already there); coming back checks for a new one.
      document.addEventListener("visibilitychange", () => {
        if (document.hidden) { if (pending && !typing()) reload(); else swap(); }
        else { shownAt = performance.now(); autoCheck(); }
      });
      addEventListener("pageshow", (e) => { if (e.persisted) { shownAt = performance.now(); autoCheck(); } });
      addEventListener("online", autoCheck);
      setInterval(() => { if (!document.hidden) autoCheck(); }, 30 * MIN);
      if (reg.installing) watch(reg.installing);
      if (reg.waiting) { swap(); onWaiting(); } // one that came down last time takes over as the app opens
      lastCheck = Date.now(); // the browser checked as the page loaded; what's live is read once the app has settled
      setTimeout(() => { lastCheck = 0; autoCheck(); }, 10000);
    } catch { emit({ status: "unsupported" }); } // no service worker: the app still works online
  });
}
