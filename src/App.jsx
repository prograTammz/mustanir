// Al-Mustanir: the app shell, on Material 3 Expressive. A player HUD on top (your seal and level, XP to the next one,
// the streak and the live link to WHOOP), the room in the middle, the M3 navigation bar below.
import { lazy, Suspense, useEffect, useState } from "react";
import { S, today, addDays, PRAYERS, rankFor, streak, T } from "@/lib/logic.js";
import { SESSION, load, flushOutbox, wake } from "@/lib/store.js";
import { useApp, go, bump, TABS, tabOf, isDark, allTotals } from "@/lib/app-state.js";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Seal, Astrolabe, Embers } from "@/components/kit";
import { Icon, Progress, Loading, Badge, haptic } from "@/components/m3/index.jsx";
import { cn } from "@/lib/utils";
import Today from "@/screens/Today.jsx";
import SignIn from "@/screens/SignIn.jsx";
// Today is the critical path; the other rooms load on first visit (and are prefetched once Today has painted).
const loadPalace = () => import("@/screens/Palace.jsx"), loadDiwan = () => import("@/screens/Diwan.jsx");
const Palace = lazy(loadPalace), Diwan = lazy(loadDiwan);
// The bottom sheets (and the drawer library under them) load once the phone is idle, or on the first tap that needs one.
const loadSheets = () => import("@/components/sheets.jsx"), Sheets = lazy(loadSheets);

const ROOMS = {
  today: { en: "Today", icon: "swords", view: Today },
  palace: { en: "Palace", icon: "castle", view: Palace },
  settings: { en: "Settings", icon: "settings", view: Diwan },
};

const fromHash = () => { const t = tabOf(location.hash.slice(1)); if (t) S.tab = t; };
fromHash();
// Back from WHOOP's or FatSecret's consent page: ?whoop=… / ?fatsecret=…
const qs = new URLSearchParams(location.search), WHOOP_BACK = qs.get("whoop"), FS_BACK = qs.get("fatsecret");
if (WHOOP_BACK || FS_BACK) history.replaceState(null, "", location.pathname + location.hash);
const MSG = {
  whoop: { connected: "WHOOP connected. Your last 30 days are in.", denied: "WHOOP access wasn’t granted.", expired: "That WHOOP link expired. Try again.", failed: "WHOOP didn’t accept the connection. See Settings." },
  fatsecret: { connected: "FatSecret connected. Your last 14 days of meals are in.", denied: "FatSecret access wasn’t granted.", expired: "That FatSecret link expired. Try again.", failed: "FatSecret didn’t accept the connection. See Settings." },
};

// What's still yours to log today (prayers not yet marked, reading not started): the home-screen badge and the Today tab's.
function openCount() {
  const d = S.days[today()] || {}, pr = d.prayers || {};
  return PRAYERS.filter(([k]) => !pr[k]).length + (d.pages > 0 ? 0 : 1);
}
function updateBadge() {
  if (!("setAppBadge" in navigator) || !SESSION) return;
  const open = openCount();
  (open ? navigator.setAppBadge(open) : navigator.clearAppBadge()).catch(() => {});
}

export default function App() {
  useApp();
  const [sheetsReady, setSheetsReady] = useState(false);
  useEffect(() => {
    load();
    window.__mustanirReady?.(); // lift the boot screen once the first frame is on screen
    for (const [k, v] of [["whoop", WHOOP_BACK], ["fatsecret", FS_BACK]]) if (v) setTimeout(() => (v === "connected" ? toast.success : toast.error)(MSG[k][v] || `${k}: ${v}`), 500);
    const onHash = () => { fromHash(); bump(); };
    const onOnline = () => flushOutbox().then(load);
    const onVis = () => { if (!document.hidden) wake(); };
    // Warm the other rooms while the phone is idle, so the first tap on Palace or Settings is instant.
    const idle = window.requestIdleCallback || ((f) => setTimeout(f, 1500));
    idle(() => { loadPalace(); loadDiwan(); loadSheets().then(() => setSheetsReady(true)); });
    const noZoom = (e) => e.preventDefault();
    const noPinch = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    addEventListener("hashchange", onHash);
    addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, noZoom, { passive: false }));
    document.addEventListener("touchmove", noPinch, { passive: false });
    return () => {
      removeEventListener("hashchange", onHash); removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.removeEventListener(ev, noZoom));
      document.removeEventListener("touchmove", noPinch);
    };
  }, []);
  useEffect(updateBadge);

  const signin = S.mode === "signin" && !SESSION;
  const room = ROOMS[S.tab] || ROOMS.today, View = room.view;

  return (
    <div className="min-h-dvh overflow-x-clip">
      {!signin && <Hud />}
      <main className="mx-auto flex max-w-lg flex-col gap-3 px-4 pb-32">
        {signin ? <SignIn /> : (
          <Suspense fallback={<div className="grid place-items-center pt-24"><Loading size={64} contained /></div>}>
            <div key={S.tab} className="flex flex-col gap-3"><View /></div>
          </Suspense>
        )}
      </main>
      {!signin && <NavBar />}
      {!signin && (sheetsReady || S.sheet) && <Suspense fallback={null}><Sheets /></Suspense>}
      <Toaster theme={isDark() ? "dark" : "light"} />
    </div>
  );
}

/* ---------- the HUD: who you are in the game, always in sight ---------- */
function Hud() {
  const t = allTotals(), rank = rankFor(t.level), run = streak(T.office);
  return (
    <>
    <div aria-hidden="true" className="m3-banner">
      <Astrolabe />
      <Embers count={3 + run} /> {/* your streak feeds them */}
    </div>
    <header className="m3-hud sticky top-0 z-40">
      <div className="mx-auto flex h-16 max-w-lg items-center gap-3 px-4">
        <button type="button" onClick={() => { haptic(); go("palace"); }} className="state -ml-1 flex min-w-0 flex-1 items-center gap-3 rounded-full py-1 pr-3 pl-1" aria-label={`Level ${t.level}, ${rank.en}. ${t.to - t.xp} XP to level ${t.level + 1}. Open the palace.`}>
          <Seal level={t.level} size={44} className="m3-hud-seal" />
          <div className="min-w-0 flex-1 text-left">
            <div className="flex items-baseline gap-2"><span className="type-title-m em truncate text-primary-fixed">{rank.en}</span><span className="ar truncate text-[14px] text-tertiary-fixed-dim">{rank.ar}</span></div>
            <Progress value={t.frac} color="var(--md-sys-color-tertiary-fixed-dim)" track="color-mix(in srgb, var(--md-sys-color-primary-fixed) 18%, transparent)" thick className="m3-hud-xp mt-1" stop={false} />
            <div className="mt-0.5 truncate type-label-s text-primary-fixed/80 tnum">{t.xp.toLocaleString("en")} XP · {(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}</div>
          </div>
        </button>
        <span className={cn("flex h-10 shrink-0 items-center gap-1 rounded-full px-3 type-title-m em tnum", run ? "bg-fire-container text-on-fire-container" : "bg-primary-fixed/15 text-primary-fixed")} aria-label={`${run}-day streak`}>
          <Icon name="local_fire_department" fill={!!run} size={20} className={run ? "text-fire" : ""} />{run}
        </span>
        <LiveButton />
      </div>
    </header>
    </>
  );
}

// Live: the Realtime socket is open, so WHOOP and FatSecret rows land here seconds after they reach the database.
const ago = (ms) => { const m = Math.max(0, Math.round(ms / 60000)); return m < 1 ? "now" : m < 60 ? `${m}m` : m < 1440 ? `${Math.round(m / 60)}h` : `${Math.round(m / 1440)}d`; };
function lastWhoop() {
  for (const k of [today(), addDays(today(), -1)]) { const src = String((S.days[k] || {}).source || ""), t = Date.parse(src.replace(/^\D+/, "")); if (/^WHOOP/.test(src) && t) return t; }
  return null;
}
function LiveButton() {
  const [, tick] = useState(0);
  useEffect(() => { const id = setInterval(() => tick((x) => x + 1), 30000); return () => clearInterval(id); }, []);
  const st = S.live, t = lastWhoop(), label = st === "live" ? "Live" : st === "connecting" ? "Connecting" : "Offline";
  return (
    <button type="button" onClick={() => { haptic(); wake(); }} aria-label={`${label}${t ? `, WHOOP data ${ago(Date.now() - t)} ago` : ""}. Tap to sync.`}
      className="m3-btn state relative grid size-10 shrink-0 place-items-center bg-primary-fixed/15 text-primary-fixed [--rp:12px]">
      <Icon name={st === "live" ? "cloud_done" : st === "connecting" ? "sync" : "cloud_off"} size={22} className={st === "connecting" ? "spin-slow [animation-duration:1.2s]" : ""} />
      <span className={cn("absolute top-1.5 right-1.5 size-2.5 rounded-full border-2 border-on-primary-fixed", st === "live" ? "live-dot bg-success" : st === "connecting" ? "bg-warning" : "bg-outline")} />
    </button>
  );
}

/* ---------- the M3 navigation bar: a pill indicator springs open under the active room ---------- */
function NavBar() {
  const open = openCount();
  return (
    <nav aria-label="Rooms" className="m3-navbar pb-safe fixed inset-x-0 bottom-0 z-40 bg-surface-container">
      <div className="mx-auto flex h-20 max-w-lg items-stretch">
        {TABS.map((k) => {
          const R = ROOMS[k], on = S.tab === k;
          return (
            <button key={k} type="button" onClick={() => { haptic(); go(k); }} aria-current={on ? "page" : undefined} className="group flex flex-1 flex-col items-center justify-center gap-1 pt-1">
              <span className="relative grid h-8 w-16 place-items-center">
                <span className={cn("absolute inset-0 rounded-full bg-secondary-container transition-all duration-500 [transition-timing-function:var(--md-sys-motion-spring-fast-spatial)]", on ? "scale-x-100 opacity-100" : "scale-x-50 opacity-0")} />
                <span className="state absolute inset-0 rounded-full" />
                <Icon name={R.icon} fill={on} size={24} className={cn("relative transition-colors", on ? "text-on-secondary-container" : "text-on-surface-variant")} />
                {k === "today" && open > 0 && S.selected === today() && <Badge className="absolute top-0 right-3">{open}</Badge>}
              </span>
              <span className={cn("type-label-m transition-colors", on ? "em text-on-surface" : "text-on-surface-variant")}>{R.en}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
