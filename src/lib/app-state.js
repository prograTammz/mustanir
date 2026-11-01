// React bridge for the plain-JS state in logic.js/store.js: one version counter, bumped on every change.
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { S, dayXP, totals, rankFor, today, medals, dayMinisters } from "./logic.js";
import { saveDay, setRenderer, setRemoteHandler, LS } from "./store.js";
import { xpFloat, levelUp, burst } from "./fx.js";
import { toast } from "sonner";

let version = 0;
const subs = new Set();
export function bump() { version++; subs.forEach((f) => f()); }
export function useApp() { return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => version); }
setRenderer(bump);

// The engine's whole-history passes (totals, medals) run once per change, not once per component that shows them.
let memoRev = -1;
const memoMap = new Map();
export function memo(key, fn) {
  if (memoRev !== version) { memoMap.clear(); memoRev = version; }
  if (!memoMap.has(key)) memoMap.set(key, fn());
  return memoMap.get(key);
}
export const allTotals = () => memo("totals", totals);
export const allMedals = () => memo("medals", medals);

// Where the last tap happened, so rewards rise from the finger.
let lastPt = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => { lastPt = { x: e.clientX, y: e.clientY }; }, true);

S.selected = today();
export const rec = () => S.days[S.selected] || (S.days[S.selected] = {});
// Every change to a day goes through here, so the reward shown is the real XP delta.
const wonIds = () => new Set(medals().filter((m) => m.won).map((m) => m.id));
const isPerfect = (s) => Object.values(dayMinisters(s)).every((v) => v >= 0.9);
export function set(k, v) {
  const before = dayXP(S.selected), lvBefore = totals().level, had = wonIds(), wasPerfect = isPerfect(S.selected);
  rec()[k] = v; saveDay(S.selected);
  const after = dayXP(S.selected), t = totals();
  bump();
  if (after !== before) xpFloat(lastPt.x, lastPt.y - 10, after - before);
  // The moments worth a fanfare: a perfect day, a new medal, a new level.
  if (!wasPerfect && isPerfect(S.selected)) setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 40); toast.success("Perfect day · +25 XP", { description: "Every minister at 90% or more." }); }, 350);
  const fresh = medals().filter((m) => m.won && !had.has(m.id));
  fresh.forEach((m, i) => setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 34); toast.success(`Medal won · ${m.en}`, { description: `${m.ar} · ${m.how}` }); }, 700 + i * 900));
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level)), 500 + fresh.length * 900);
}
export function setQuiet(k, v) { rec()[k] = v; saveDay(S.selected); }

// Data the server sent (WHOOP, FatSecret, another device): apply it, then celebrate what it earned, as if you'd tapped.
const lastWorkout = (d) => (d?.workoutsDetail || []).slice(-1)[0];
setRemoteHandler((apply, info = {}) => {
  if (info.initial || !S.loaded) return apply();
  const t0 = today(), before = dayXP(t0), lvBefore = totals().level, had = wonIds();
  apply();
  const after = dayXP(t0), t = totals();
  if (after > before) {
    const w = info.date === t0 ? lastWorkout(info.data) : null;
    toast(`+${after - before} XP from your watch`, {
      description: w ? `${w.a} · ${w.min} min · ${w.s}–${w.e}` : "New WHOOP data counted toward today.",
      className: "toast-glass toast-live",
    });
  }
  const fresh = medals().filter((m) => m.won && !had.has(m.id));
  fresh.forEach((m, i) => setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 34); toast.success(`Medal won · ${m.en}`, { description: `${m.ar} · ${m.how}` }); }, 600 + i * 900));
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level), "Your watch carried you over the line."), 400 + fresh.length * 900);
});

export const TABS = ["today", "palace", "settings"];
// Older links (notifications, shortcuts, bookmarks) still land in the right place.
export const ALIAS = { decrees: "today", progress: "palace", records: "palace", council: "palace", diwan: "settings" };
export const tabOf = (h) => (TABS.includes(h) ? h : ALIAS[h] || null);
// Rooms change with a View Transition where the browser has one (iOS 18+): a short cross-fade, the tab bar stays put.
export function go(tab) {
  const next = tabOf(tab) || "today";
  const apply = () => { S.tab = next; history.replaceState(null, "", "#" + S.tab); bump(); scrollTo({ top: 0 }); };
  if (next === S.tab) return scrollTo({ top: 0, behavior: "smooth" });
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(() => flushSync(apply));
  else apply();
}

/* ---------- appearance: system, light or dark ---------- */
const mq = matchMedia("(prefers-color-scheme: dark)");
export const themePref = () => LS.get("a2-theme", "system");
export const isDark = () => (themePref() === "system" ? mq.matches : themePref() === "dark");
export function applyTheme() {
  const dark = isDark();
  document.documentElement.classList.toggle("dark", dark);
  document.querySelectorAll('meta[name="theme-color"]').forEach((m) => { m.setAttribute("content", dark ? "#0E1110" : "#F6F6F3"); m.removeAttribute("media"); });
}
export function setTheme(p) { LS.set("a2-theme", p); applyTheme(); bump(); }
mq.addEventListener?.("change", () => { if (themePref() === "system") { applyTheme(); bump(); } });
applyTheme();
