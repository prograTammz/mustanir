// Al-Mustanir: the app shell. Three rooms (Today, Palace, Settings), a quiet bar on scroll, a floating tab bar.
import { useEffect, useState } from "react";
import { CircleCheck, Landmark, Settings as SettingsIcon } from "lucide-react";
import { S, today, PRAYERS } from "@/lib/logic.js";
import { SESSION, load, flushOutbox } from "@/lib/store.js";
import { useApp, go, bump, TABS, tabOf, isDark } from "@/lib/app-state.js";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Sheets } from "@/components/sheets.jsx";
import { cn } from "@/lib/utils";
import Today from "@/screens/Today.jsx";
import Palace from "@/screens/Palace.jsx";
import Diwan from "@/screens/Diwan.jsx";
import SignIn from "@/screens/SignIn.jsx";

const ROOMS = {
  today: { en: "Today", icon: CircleCheck, view: Today },
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
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    load();
    window.__mustanirReady?.(); // lift the boot screen once the first frame is on screen
    for (const [k, v] of [["whoop", WHOOP_BACK], ["fatsecret", FS_BACK]]) if (v) setTimeout(() => (v === "connected" ? toast.success : toast.error)(MSG[k][v] || `${k}: ${v}`), 500);
    const onScroll = () => setScrolled(scrollY > 8);
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
  const room = ROOMS[S.tab] || ROOMS.today, View = room.view;

  return (
    <div className="min-h-dvh">
      <header className={cn("pt-safe sticky top-0 z-40 transition-[background-color,border-color] duration-200",
        scrolled ? "border-b border-border/70 bg-[var(--bar)] backdrop-blur-xl backdrop-saturate-150" : "border-b border-transparent")}>
        <div className="mx-auto flex h-11 max-w-lg items-center justify-center px-4">
          <span className={cn("text-[15px] font-semibold transition-opacity duration-200", scrolled && !signin ? "opacity-100" : "opacity-0")}>{room.en}</span>
        </div>
      </header>

      <main className="mx-auto max-w-lg px-4 pb-32">
        {signin ? <SignIn /> : <div key={S.tab} className="flex flex-col gap-3 animate-in fade-in-0 duration-300"><View /></div>}
      </main>

      {!signin && (
        <nav aria-label="Rooms" className="pb-safe fixed inset-x-0 bottom-0 z-40 px-6">
          <div className="mx-auto flex max-w-xs items-stretch rounded-full border border-border/70 bg-[var(--bar)] p-1 shadow-[0_8px_30px_-10px_rgb(0_0_0/0.25)] backdrop-blur-xl backdrop-saturate-150">
            {TABS.map((k) => {
              const R = ROOMS[k], on = S.tab === k, Icon = R.icon;
              return (
                <button key={k} onClick={() => go(k)} aria-current={on ? "page" : undefined}
                  className={cn("press flex flex-1 flex-col items-center gap-0.5 rounded-full py-1.5 text-[10.5px] font-semibold", on ? "bg-foreground/[0.06] text-foreground dark:bg-white/10" : "text-muted-foreground")}>
                  <Icon className="size-[21px]" strokeWidth={on ? 2.2 : 1.8} />
                  {R.en}
                </button>
              );
            })}
          </div>
        </nav>
      )}
      {!signin && <Sheets />}
      <Toaster theme={isDark() ? "dark" : "light"} position="top-center" />
    </div>
  );
}
