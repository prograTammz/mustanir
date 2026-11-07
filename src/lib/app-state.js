// React bridge for the plain-JS state in logic.js/store.js: one version counter, bumped on every change.
import { useSyncExternalStore } from "react";
import { flushSync } from "react-dom";
import { S, dayXP, totals, rankFor, today, medals, dayMinisters, checklistFor, MINISTERS, isPerfect, counted, isRestDay } from "./logic.js";
import { saveDay, setRenderer, setRemoteHandler, LS } from "./store.js";
import { xpFloat, levelUp, burst } from "./fx.js";
import { play } from "./sound.js";
import { haptic } from "@/components/m3/index.jsx";
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
// What a finished quest is called when its minister reaches full marks (Body is filled in by the watch, Purity starts full).
const QUESTS = { faith: "The five prayers", knowledge: "Today’s reading", habits: "Routines and sleep" };
const REWARD = "m3-snack m3-reward";
export function set(k, v) {
  const s = S.selected, before = dayXP(s), lvBefore = totals().level, had = wonIds(), wasPerfect = isPerfect(s), mBefore = dayMinisters(s), cBefore = checklistFor(s);
  rec()[k] = v; saveDay(s);
  const after = dayXP(s), t = totals(), mAfter = dayMinisters(s), cAfter = checklistFor(s);
  bump();
  if (after !== before) xpFloat(lastPt.x, lastPt.y - 10, after - before);
  // Quest complete: a minister reaches full marks, or the last task is ticked.
  const done = Object.keys(QUESTS).filter((m) => mBefore[m] < 1 && mAfter[m] >= 1).map((m) => QUESTS[m]);
  if (cAfter.total && cAfter.done === cAfter.total && cBefore.done < cBefore.total) done.push("The day’s work");
  done.forEach((q, i) => setTimeout(() => { play("quest"); haptic(12); toast(`Quest complete · ${q}`, { className: REWARD, description: `${counted(s).filter((m) => mAfter[m] >= 0.9).length} of ${counted(s).length} ministers at 90% today.` }); }, 250 + i * 600));
  // The moments worth a fanfare: a perfect day, a new medal, a new level.
  if (!wasPerfect && isPerfect(s)) setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 48); play("chest"); haptic(30); toast("Perfect day · chest opened · +25 XP", { className: REWARD, description: isRestDay(s) ? "Rest day: Faith, Knowledge and Purity at 90% or more." : "Every minister at 90% or more." }); }, 400);
  const fresh = medals().filter((m) => m.won && !had.has(m.id));
  fresh.forEach((m, i) => setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 40); play("medal"); haptic(30); toast(`Medal won · ${m.en}`, { className: REWARD, description: `${m.ar} · ${m.how}` }); }, 800 + i * 900));
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level)), 600 + fresh.length * 900);
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
    play("xp");
    const w = info.date === t0 ? lastWorkout(info.data) : null;
    toast(`+${after - before} XP from your watch`, {
      description: w ? `${w.a} · ${w.min} min · ${w.s}–${w.e}` : "New WHOOP data counted toward today.",
      className: "m3-snack m3-reward",
    });
  }
  const fresh = medals().filter((m) => m.won && !had.has(m.id));
  fresh.forEach((m, i) => setTimeout(() => { burst(innerWidth / 2, innerHeight / 3, 40); play("medal"); toast(`Medal won · ${m.en}`, { className: "m3-snack m3-reward", description: `${m.ar} · ${m.how}` }); }, 600 + i * 900));
  if (t.level > lvBefore) setTimeout(() => levelUp(t.level, rankFor(t.level), "Your watch carried you over the line."), 400 + fresh.length * 900);
});

// Bottom sheets (src/components/sheets.jsx, loaded on demand): one at a time, picked by S.sheet.type.
export function openSheet(sheet) { S.sheet = sheet; bump(); }
export function closeSheet() { S.sheet = null; bump(); }

export const TABS = ["today", "palace", "settings"];
// Older links (notifications, shortcuts, bookmarks) still land in the right place.
export const ALIAS = { decrees: "today", progress: "palace", records: "palace", council: "palace", diwan: "settings", report: "palace" };
export const tabOf = (h) => (TABS.includes(h) ? h : ALIAS[h] || null);
// Rooms change with a View Transition where the browser has one (iOS 18+): a short cross-fade, the tab bar stays put.
// Each room keeps your place, like native tabs; tapping the room you're already in goes back to its top.
const scrollOf = {};
export function go(tab) {
  const next = tabOf(tab) || "today";
  const apply = () => { scrollOf[S.tab] = scrollY; S.tab = next; history.replaceState(null, "", "#" + S.tab); bump(); scrollTo({ top: scrollOf[next] || 0 }); };
  if (next === S.tab) return scrollTo({ top: 0, behavior: "smooth" });
  if (document.startViewTransition && !matchMedia("(prefers-reduced-motion: reduce)").matches) document.startViewTransition(() => flushSync(apply));
  else flushSync(apply);
}

/* ---------- appearance: system, light or dark ---------- */
const mq = matchMedia("(prefers-color-scheme: dark)");
export const themePref = () => LS.get("a2-theme", "system");
export const isDark = () => (themePref() === "system" ? mq.matches : themePref() === "dark");
export function applyTheme() {
  const dark = isDark();
  document.documentElement.classList.toggle("dark", dark);
}
export function setTheme(p) { LS.set("a2-theme", p); applyTheme(); bump(); }
mq.addEventListener?.("change", () => { if (themePref() === "system") { applyTheme(); bump(); } });
applyTheme();
