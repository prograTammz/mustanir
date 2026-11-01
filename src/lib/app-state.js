// React bridge for the plain-JS state in logic.js/store.js: one version counter, bumped on every change.
import { useSyncExternalStore } from "react";
import { S, dayXP, totals, rankFor, today } from "./logic.js";
import { saveDay, setRenderer, LS } from "./store.js";
import { xpFloat, levelUp } from "./fx.js";

let version = 0;
const subs = new Set();
export function bump() { version++; subs.forEach((f) => f()); }
export function useApp() { return useSyncExternalStore((cb) => { subs.add(cb); return () => subs.delete(cb); }, () => version); }
setRenderer(bump);

// Where the last tap happened, so rewards rise from the finger.
let lastPt = { x: innerWidth / 2, y: innerHeight / 2 };
addEventListener("pointerdown", (e) => { lastPt = { x: e.clientX, y: e.clientY }; }, true);

S.selected = today();
export const rec = () => S.days[S.selected] || (S.days[S.selected] = {});
// Every change to a day goes through here, so the reward shown is the real XP delta.
export function set(k, v) {
  const before = dayXP(S.selected), lvBefore = totals().level;
  rec()[k] = v; saveDay(S.selected);
  const after = dayXP(S.selected), t = totals();
  bump();
  if (after !== before) xpFloat(lastPt.x, lastPt.y - 10, after - before);
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level)), 500);
}
export function setQuiet(k, v) { rec()[k] = v; saveDay(S.selected); }

export const TABS = ["today", "progress", "settings"];
// Older links (notifications, shortcuts, bookmarks) still land in the right place.
export const ALIAS = { palace: "today", decrees: "today", records: "progress", council: "progress", diwan: "settings" };
export const tabOf = (h) => (TABS.includes(h) ? h : ALIAS[h] || null);
export function go(tab) { S.tab = tabOf(tab) || "today"; history.replaceState(null, "", "#" + S.tab); bump(); scrollTo({ top: 0 }); }

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
