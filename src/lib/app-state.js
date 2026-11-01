// React bridge for the plain-JS state in logic.js/store.js: one version counter, bumped on every change.
import { useSyncExternalStore } from "react";
import { S, dayXP, totals, rankFor, today, medals, dayMinisters } from "./logic.js";
import { saveDay, setRenderer, LS } from "./store.js";
import { xpFloat, levelUp, burst } from "./fx.js";
import { toast } from "sonner";

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

export const TABS = ["today", "palace", "settings"];
// Older links (notifications, shortcuts, bookmarks) still land in the right place.
export const ALIAS = { decrees: "today", progress: "palace", records: "palace", council: "palace", diwan: "settings" };
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
