// Al-Mustanir: the app shell. A large title per room, a translucent bar on scroll, a floating tab bar.
import { useEffect, useState } from "react";
import { Landmark, ScrollText, Activity, Scale, Settings } from "lucide-react";
import { S, today, hijri, termDay, termLength, termInfo, fmt } from "@/lib/logic.js";
import { SESSION, load, flushOutbox } from "@/lib/store.js";
import { useApp, go, bump, TABS, isDark } from "@/lib/app-state.js";
import { Toaster } from "@/components/ui/sonner";
import { Sheets } from "@/components/sheets.jsx";
import { Ar } from "@/components/kit";
import { cn } from "@/lib/utils";
import Palace from "@/screens/Palace.jsx";
import Decrees from "@/screens/Decrees.jsx";
import Records from "@/screens/Records.jsx";
import Council from "@/screens/Council.jsx";
import Diwan from "@/screens/Diwan.jsx";
import SignIn from "@/screens/SignIn.jsx";

const ROOMS = {
  palace: { en: "Palace", ar: "القصر", icon: Landmark, view: Palace },
  decrees: { en: "Decrees", ar: "المراسيم", icon: ScrollText, view: Decrees },
  records: { en: "Records", ar: "السجلات", icon: Activity, view: Records },
  council: { en: "Council", ar: "المجلس", icon: Scale, view: Council },
  diwan: { en: "Diwan", ar: "الديوان", icon: Settings, view: Diwan },
};

const fromHash = () => { const t = location.hash.slice(1); if (TABS.includes(t)) S.tab = t; };
fromHash();

export default function App() {
  useApp();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    load();
    const onScroll = () => setScrolled(scrollY > 30);
    const onHash = () => { fromHash(); bump(); };
    const onOnline = () => flushOutbox().then(load);
    const onVis = () => { if (!document.hidden && !S.dirty.size) load(); };
    const noZoom = (e) => e.preventDefault();
    const noPinch = (e) => { if (e.touches.length > 1) e.preventDefault(); };
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("hashchange", onHash);
    addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onVis);
    ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.addEventListener(ev, noZoom, { passive: false }));
    document.addEventListener("touchmove", noPinch, { passive: false });
    return () => {
      removeEventListener("scroll", onScroll); removeEventListener("hashchange", onHash); removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onVis);
      ["gesturestart", "gesturechange", "gestureend"].forEach((ev) => document.removeEventListener(ev, noZoom));
      document.removeEventListener("touchmove", noPinch);
    };
  }, []);

  const signin = S.mode === "signin" && !SESSION;
  const room = ROOMS[S.tab] || ROOMS.palace, View = room.view;
  const t = today(), dn = termDay(t), total = termLength(t), term = termInfo(t);
  const termTxt = dn < 1 ? `Term ${term.n} in ${-dn + 1} d` : `Term ${term.n} · ${dn}/${total}`;

  return (
    <div className="bg-pattern min-h-dvh">
      <header className={cn("pt-safe sticky top-0 z-40 transition-colors", scrolled ? "border-b border-border/60 bg-[var(--bar)] backdrop-blur-xl backdrop-saturate-150" : "bg-transparent")}>
        <div className="mx-auto flex h-11 max-w-xl items-center justify-between gap-3 px-5">
          <Ar className="truncate text-[13px] text-gold">{hijri(t)}</Ar>
          <span className={cn("text-[15px] font-semibold transition-opacity", scrolled ? "opacity-100" : "opacity-0")}>{signin ? "" : room.en}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground tnum">{termTxt}</span>
            <div className="h-1 w-12 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-gold" style={{ width: `${Math.max(0, Math.min(100, ((dn - 1) / total) * 100))}%` }} /></div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-xl px-4 pb-36">
        {signin ? <SignIn /> : (
          <>
            <div className="flex items-end justify-between px-1 pt-1 pb-4">
              <div>
                <h1 className="text-[34px] leading-none font-bold tracking-tight">{room.en}</h1>
                {S.tab === "palace" && <p className="mt-1.5 text-sm text-muted-foreground">{fmt(t)}{dn >= 1 ? ` · ${term.name}` : ""}</p>}
              </div>
              <Ar className="text-[28px] leading-none text-gold">{room.ar}</Ar>
            </div>
            <div key={S.tab} className="flex flex-col gap-4 animate-in fade-in-0 slide-in-from-bottom-1 duration-300"><View /></div>
          </>
        )}
      </main>

      {!signin && (
        <nav aria-label="Palace rooms" className="pb-safe fixed inset-x-0 bottom-0 z-40 px-4">
          <div className="mx-auto flex max-w-md items-stretch justify-between rounded-[28px] border border-border/70 bg-[var(--bar)] p-1.5 shadow-[0_10px_40px_-10px_rgb(0_0_0/0.35)] backdrop-blur-xl backdrop-saturate-150">
            {TABS.map((k) => {
              const R = ROOMS[k], on = S.tab === k, Icon = R.icon;
              return (
                <button key={k} onClick={() => go(k)} aria-current={on ? "page" : undefined}
                  className={cn("flex flex-1 flex-col items-center gap-0.5 rounded-[22px] py-1.5 text-[10.5px] font-semibold transition-colors", on ? "bg-primary/10 text-primary dark:bg-primary/15" : "text-muted-foreground")}>
                  <Icon className="size-[22px]" strokeWidth={on ? 2.3 : 1.8} />
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
