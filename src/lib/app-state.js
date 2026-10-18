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

export const TABS = ["palace", "decrees", "records", "council", "diwan"];
export function go(tab) { S.tab = tab; history.replaceState(null, "", "#" + tab); bump(); scrollTo({ top: 0 }); }

/* ---------- appearance: system, light or dark ---------- */
const mq = matchMedia("(prefers-color-scheme: dark)");
export const themePref = () => LS.get("a2-theme", "system");
export const isDark = () => (themePref() === "system" ? mq.matches : themePref() === "dark");
export function applyTheme() {
  const dark = isDark();
  document.documentElement.classList.toggle("dark", dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dark ? "#0B161D" : "#F8F5EE");
}
export function setTheme(p) { LS.set("a2-theme", p); applyTheme(); bump(); }
mq.addEventListener?.("change", () => { if (themePref() === "system") { applyTheme(); bump(); } });
applyTheme();
