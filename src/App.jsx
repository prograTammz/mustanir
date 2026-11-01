// Al-Mustanir: the app shell. Three rooms (Today, Palace, Settings), an iOS 26 top row (glass buttons, the scroll edge
// effect, the inline title once the large one scrolls away) and a floating glass tab bar.
import { useEffect, useState } from "react";
import { CircleCheck, Landmark, Settings as SettingsIcon } from "lucide-react";
import { S, today, PRAYERS } from "@/lib/logic.js";
import { SESSION, load, flushOutbox } from "@/lib/store.js";
import { useApp, go, bump, TABS, tabOf, isDark } from "@/lib/app-state.js";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sheets } from "@/components/sheets.jsx";
import { cn } from "@/lib/utils";
import Today, { DayNav, BackToToday } from "@/screens/Today.jsx";
import Palace from "@/screens/Palace.jsx";
import Diwan from "@/screens/Diwan.jsx";
import SignIn from "@/screens/SignIn.jsx";

const ROOMS = {
  today: { en: "Today", icon: CircleCheck, view: Today, left: BackToToday, right: DayNav },
  palace: { en: "Palace", icon: Landmark, view: Palace },
  settings: { en: "Settings", icon: SettingsIcon, view: Diwan },
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

// The home-screen badge: what's still yours to log today (prayers not yet marked, reading not started).
function updateBadge() {
  if (!("setAppBadge" in navigator) || !SESSION) return;
  const d = S.days[today()] || {}, pr = d.prayers || {};
  const open = PRAYERS.filter(([k]) => !pr[k]).length + (d.pages > 0 ? 0 : 1);
  (open ? navigator.setAppBadge(open) : navigator.clearAppBadge()).catch(() => {});
}

export default function App() {
  useApp();
  const [y, setY] = useState(0);
  useEffect(() => {
    load();
    window.__mustanirReady?.(); // lift the boot screen once the first frame is on screen
    for (const [k, v] of [["whoop", WHOOP_BACK], ["fatsecret", FS_BACK]]) if (v) setTimeout(() => (v === "connected" ? toast.success : toast.error)(MSG[k][v] || `${k}: ${v}`), 500);
    const onScroll = () => setY(scrollY);
    const onHash = () => { fromHash(); bump(); };
    const onOnline = () => flushOutbox().then(load);
    const onVis = () => { if (!document.hidden && !S.dirty.size) load(); };
    const onUpdate = (e) => toast("A new version is ready", { duration: Infinity, action: { label: "Update", onClick: () => e.detail() } });
    const noZoom = (e) => e.preventDefault();
    const noPinch = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("hashchange", onHash);
    addEventListener("online", onOnline);
    addEventListener("mustanir:update", onUpdate);
    document.addEventListener("visibilitychange", onVis);
    ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, noZoom, { passive: false }));
    document.addEventListener("touchmove", noPinch, { passive: false });
    return () => {
      removeEventListener("scroll", onScroll); removeEventListener("hashchange", onHash); removeEventListener("online", onOnline); removeEventListener("mustanir:update", onUpdate);
      document.removeEventListener("visibilitychange", onVis);
      ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.removeEventListener(ev, noZoom));
      document.removeEventListener("touchmove", noPinch);
    };
  }, []);
  useEffect(updateBadge);

  const signin = S.mode === "signin" && !SESSION;
  const room = ROOMS[S.tab] || ROOMS.today, View = room.view, L = room.left, R = room.right;

  return (
    <div className="min-h-dvh">
      <header className="pt-safe sticky top-0 z-40">
        <div aria-hidden className={cn("edge pointer-events-none absolute inset-x-0 top-0 -bottom-6 transition-opacity duration-300", y > 4 ? "opacity-100" : "opacity-0")} />
        <div className="relative mx-auto grid h-[52px] max-w-lg grid-cols-[1fr_auto_1fr] items-center gap-2 px-4">
          <div className="flex justify-start">{!signin && L && <L />}</div>
          <span className={cn("text-[17px] font-semibold transition-opacity duration-200", y > 56 && !signin ? "opacity-100" : "opacity-0")}>{room.en}</span>
          <div className="flex justify-end">{!signin && R && <R />}</div>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-32">
        {signin ? <SignIn /> : <div key={S.tab} className="flex flex-col gap-3 animate-in fade-in-0 duration-300"><View /></div>}
      </main>

      {!signin && (
        <nav aria-label="Rooms" className="pb-safe fixed inset-x-0 bottom-0 z-40 px-6">
          <div className="glass mx-auto flex max-w-xs items-stretch rounded-full p-1">
            {TABS.map((k) => {
              const R = ROOMS[k], on = S.tab === k, Icon = R.icon;
              return (
                <button key={k} onClick={() => go(k)} aria-current={on ? "page" : undefined}
                  className={cn("press flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-semibold", on ? "bg-foreground/[0.07] text-primary dark:bg-white/[0.12]" : "text-foreground/70")}>
                  <Icon className="size-[21px]" strokeWidth={on ? 2.2 : 1.8} />
                  {R.en}
                </button>
              );
            })}
          </div>
        </nav>
      )}
      {!signin && <Sheets />}
      <Toaster theme={isDark() ? "dark" : "light"} />
    </div>
  );
}
