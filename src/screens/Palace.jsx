// The palace: where you stand in the game. Rank ladder, XP, streaks, medals, then the council, the advisor, trends and every measure.
import { useEffect, useRef, useState } from "react";
import { Crown, ChevronRight, Flame, Lock, Trophy } from "lucide-react";
import { S, MINISTERS, today, addDays, range, diff, fmt, manual, day, dayXP, inOffice, totals, rankFor, RANKS, streak, bestStreak, T, medals, periods, score, verdict, levelStart, termDay, termLength,
  termIndex, termInfo, checklistFor, deficitOf } from "@/lib/logic.js";
import { SESSION, loadHealth, saveSettings } from "@/lib/store.js";
import { useApp, bump, allTotals, allMedals } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { AdvisorCard } from "@/components/advisor.jsx";
import { Ar, LargeTitle, Section, Hint, Fold, Bar, pctTxt } from "@/components/kit";
import { TrendChart } from "@/components/charts";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Health from "./Health.jsx";
import { Seal, SEAL, fmtN } from "./Today.jsx";

let healthLoading = false, healthFailedAt = 0;
export function useHealth() {
  useEffect(() => {
    if (S.health || healthLoading || !SESSION || Date.now() - healthFailedAt < 60000) return;
    healthLoading = true;
    loadHealth().then(() => { healthLoading = false; bump(); }).catch(() => { healthLoading = false; healthFailedAt = Date.now(); bump(); });
  }, []);
  return { loading: healthLoading, failed: !!healthFailedAt };
}

export default function Palace() {
  useApp();
  const hs = useHealth();
  return (
    <>
      <LargeTitle title="Palace" ar="القصر" caption={`Term ${termInfo().n} · day ${Math.max(1, termDay(today()))} of ${termLength()}`} />
      <Ladder />
      <Streaks />
      <Medals />
      <Council />
      <AdvisorCard full />
      <Trends />
      <Card className="py-1"><CardContent>
        <Fold title="All health data" summary="Body plan · every measure">
          <div className="-mx-4 flex flex-col gap-3 pt-1 pb-3 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-x-0 [&>[data-slot=card]]:border-b-0"><Health hs={hs} /></div>
        </Fold>
      </CardContent></Card>
    </>
  );
}

/* ---------- the rank ladder and XP ---------- */
function Ladder() {
  const strip = useRef(null);
  // Open the ladder on your rank, measured against the strip itself (offsetLeft is relative to some other ancestor).
  useEffect(() => {
    const st = strip.current, el = st?.querySelector("[data-cur]");
    if (el) st.scrollLeft += el.getBoundingClientRect().left - st.getBoundingClientRect().left - 16;
  }, []);
  const t = allTotals(), rank = rankFor(t.level), next = RANKS.find((r) => r.from > t.level);
  const days = Object.keys(S.days).filter((k) => inOffice(k) && manual(S.days[k]));
  const week = range(addDays(today(), -6), addDays(today(), 1)).reduce((a, k) => a + (inOffice(k) && manual(S.days[k]) ? dayXP(k) : 0), 0);
  const best = days.reduce((a, k) => Math.max(a, dayXP(k)), 0);
  const toNext = next ? Math.max(0, levelStart(next.from) - t.xp) : 0;
  return (
    <Card className="gap-0 overflow-hidden py-0">
      <div className="relative overflow-hidden bg-[linear-gradient(150deg,#17604F_0%,#0F4A3C_48%,#0A3128_100%)] px-4 pt-5 pb-4 text-white">
        <svg viewBox="0 0 24 24" aria-hidden className="pointer-events-none absolute -top-12 -right-12 size-48 fill-white/[0.05]"><path d={SEAL} /></svg>
        <div className="relative flex items-center gap-4">
          <Seal level={t.level} size={72} />
          <div className="min-w-0 flex-1">
            <Ar className="block text-left text-[28px] leading-tight text-[#EBD08E]">{rank.ar}</Ar>
            <div className="text-[15px] text-white/80">{rank.en} · Level {t.level}</div>
          </div>
        </div>
        <div className="relative mt-4 h-2 overflow-hidden rounded-full bg-white/15"><div className="h-full rounded-full bg-[linear-gradient(90deg,#C99A3E,#F1D896)] transition-[width] duration-700" style={{ width: `${t.frac * 100}%` }} /></div>
        <div className="relative mt-1.5 flex justify-between gap-2 text-[12.5px] text-white/70 tnum">
          <span>{t.xp.toLocaleString("en")} XP</span>
          <span className="truncate">{(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}{next && next.from === t.level + 1 ? ` · ${next.en}` : ""}</span>
        </div>
      </div>
      <div className="pt-4">
        <div className="flex items-baseline justify-between px-4">
          <h2 className="text-[15px] font-semibold">The ranks</h2>
          {next && <span className="text-[13px] text-muted-foreground tnum">{next.en} in {toNext.toLocaleString("en")} XP</span>}
        </div>
        <div ref={strip} className="no-scrollbar mt-2.5 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto px-4 pb-1">
          {RANKS.map((r) => {
            const cur = r === rank, got = t.level >= r.from;
            return (
              <div key={r.from} data-cur={cur || undefined} className={cn("flex w-[100px] shrink-0 snap-start flex-col items-center gap-1 rounded-2xl px-2 pt-3 pb-2.5 text-center",
                cur ? "bg-gold-soft shadow-[inset_0_0_0_1.5px_var(--gold)]" : "bg-muted")}>
                {got ? <Seal level={r.from} size={30} /> : <span className="grid size-[30px] place-items-center"><Lock className="size-4 text-muted-foreground" /></span>}
                <Ar className={cn("text-[15px] leading-tight", got ? "text-gold" : "text-muted-foreground")}>{r.ar}</Ar>
                <span className={cn("text-[12.5px] leading-tight font-semibold", !got && "text-muted-foreground")}>{r.en}</span>
                <span className={cn("mt-0.5 text-[10.5px] leading-tight tnum", cur ? "font-semibold text-gold" : "text-muted-foreground")}>
                  {cur ? "You’re here" : got ? "Reached" : `Level ${r.from}`}<br />{cur ? `Level ${t.level}` : `${levelStart(r.from).toLocaleString("en")} XP`}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 p-4">
        {[[week.toLocaleString("en"), "XP this week"], [best, "best day"], [days.length, "days logged"]].map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-muted px-2 py-2.5 text-center">
            <div className="text-[19px] font-bold tracking-tight tnum">{v}</div>
            <div className="text-[11.5px] leading-tight text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ---------- streaks ---------- */
const STREAKS = [["office", "Days in office", "Log something every day"], ["prayers", "All five prayers", "Every prayer, every day"], ["fajr", "Up for Fajr", "Awake around Fajr, from WHOOP"],
  ["abstain", "Purity", "Clean, no slip logged"], ["read", "Reading", "Your pages, every day"], ["regular", "Sleep rhythm", "Consistency on target"], ["vital", "Vitality", "4 of 5 vitals"]];
function Streaks() {
  return (
    <Section title="Streaks" right={<span className="text-[13px] text-muted-foreground">now · best</span>}>
      <div className="flex flex-col">
        {STREAKS.map(([k, l, how]) => {
          const now = streak(T[k]), best = bestStreak(T[k]);
          return (
            <div key={k} className="flex items-center gap-3 border-t py-2.5 first:border-t-0">
              <Flame className={cn("size-[18px] shrink-0", now ? "fill-[#F0A23B] text-[#F0A23B]" : "text-muted-foreground/40")} />
              <div className="min-w-0 flex-1"><div className="text-[15px]">{l}</div><div className="truncate text-[11.5px] text-muted-foreground">{how}</div></div>
              <span className="text-[17px] font-semibold tnum">{now}</span>
              <span className="w-10 text-right text-[13px] text-muted-foreground tnum">{best}</span>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

/* ---------- this month's council ---------- */
function Council() {
  const t = today(), ps = periods(t), ti = termIndex(t), term = termInfo(t);
  const cur = ps.find((p) => t >= p.start && t < p.end) || ps[0];
  const end = t < cur.end ? addDays(t, 1) : cur.end;
  const r = cur.start < end ? score(range(cur.start, end)) : null, left = diff(t, cur.end);
  const notesKey = `${ti}-${cur.i}`, note = (S.settings.revNotes || {})[notesKey] ?? "";
  return (
    <Section title={`This month · ${cur.label}`} right={<span className="text-[13px] text-muted-foreground">{left > 0 ? `Council in ${left} d` : "Council due"}</span>}>
      {!r ? <Hint>{t < cur.start ? `Term ${term.n} starts ${fmt(cur.start, { day: "numeric", month: "long" })}.` : "No days counted yet."}</Hint> : (
        <>
          <div className="flex items-baseline gap-2">
            <span className="text-[40px] leading-none font-bold tracking-tight tnum">{pctTxt(r.overall)}</span>
            <span className="text-[13px] text-muted-foreground">approval · {r.logged} of {r.n} days logged</span>
          </div>
          <div className="mt-3 flex flex-col">
            {MINISTERS.map((m) => {
              const [cls, txt] = verdict(r[m.key], m.immune);
              return (
                <button key={m.key} onClick={() => openSheet({ type: "minister", key: m.key })} className="press flex items-center gap-3 border-t py-2.5 text-left">
                  <span className="size-2.5 shrink-0 rounded-full" style={{ background: `var(--m-${m.key})` }} />
                  <span className="w-24 shrink-0 text-[14px]">{m.en.replace("Minister of ", "")}</span>
                  <Bar className="flex-1" value={r[m.key]} color={`var(--m-${m.key})`} />
                  <span className={cn("w-11 shrink-0 text-right text-[13px] font-semibold tnum", cls === "bad" && "text-bad", cls === "warn" && "text-warn")} title={txt}>{pctTxt(r[m.key])}</span>
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                </button>
              );
            })}
          </div>
          <Hint className="mt-2">Below {S.settings.threshold}% a minister’s strategy is up for impeachment at the council. Faith can’t be impeached.</Hint>
        </>
      )}
      <Fold className="mt-2 border-t" title="The council’s verdict" summary={note ? "Written" : "Notes"}>
        <Textarea key={notesKey} defaultValue={note} rows={4} className="mt-1 mb-2" placeholder="Who keeps their seat, who is replaced, and the new strategy."
          onChange={(e) => { S.settings.revNotes = { ...(S.settings.revNotes || {}), [notesKey]: e.target.value }; clearTimeout(S.timers.rev); S.timers.rev = setTimeout(saveSettings, 600); }} />
      </Fold>
    </Section>
  );
}

/* ---------- medals, with how close each one is ---------- */
function Medals() {
  const [all, setAll] = useState(false);
  const ms = allMedals(), won = ms.filter((m) => m.won), rest = ms.filter((m) => !m.won).sort((a, b) => b.frac - a.frac);
  const list = [...won, ...rest], shown = all ? list : list.slice(0, Math.max(9, won.length + 3));
  return (
    <Section title="Medals" right={<span className="text-[13px] text-muted-foreground tnum">{won.length} of {ms.length}</span>}>
      <Bar value={won.length / ms.length} color="var(--gold)" className="mb-3" />
      <div className="grid grid-cols-3 gap-2">
        {shown.map((m) => (
          <div key={m.id} className={cn("flex flex-col items-center gap-1 rounded-2xl px-2 pt-3 pb-2.5 text-center", m.won ? "bg-gold-soft ring-1 ring-gold/30" : "bg-muted")}>
            {m.won ? <Trophy className="size-5 text-gold" /> : <Crown className="size-5 text-muted-foreground/40" />}
            <span className={cn("text-[12.5px] leading-tight font-semibold", !m.won && "text-muted-foreground")}>{m.en}</span>
            <Ar className={cn("text-[12px] leading-tight", m.won ? "text-gold" : "text-muted-foreground/70")}>{m.ar}</Ar>
            <span className="text-[10.5px] leading-tight text-muted-foreground">{m.how}</span>
            {!m.won && (
              <div className="mt-1 w-full">
                <Bar value={m.frac} color="var(--gold)" className="h-1" />
                <div className="mt-1 text-[10px] text-muted-foreground tnum">{m.down ? `${fmtN(m.cur)} → ${m.goal}` : `${fmtN(m.cur)} / ${fmtN(m.goal)}`}</div>
              </div>
            )}
          </div>
        ))}
      </div>
      {list.length > shown.length || all ? (
        <button className="press mt-3 h-10 w-full rounded-full bg-muted text-[14px] font-medium" onClick={() => setAll(!all)}>{all ? "Show fewer" : `Show all ${ms.length}`}</button>
      ) : null}
    </Section>
  );
}

/* ---------- trends: one chart, pick the measure ---------- */
const RANGES = [[7, "7D"], [30, "30D"], [90, "90D"]];
function Trends() {
  const to = today(), days = S.range || 30, from = addDays(to, -days + 1), win = range(from, addDays(to, 1));
  const logged = win.filter((k) => manual(S.days[k]));
  const H = S.health?.byMetric || {};
  const series = (k, field) => {
    const map = new Map((H[k] || []).filter(([d]) => d >= from).map(([d, v]) => [d, v]));
    if (field) for (const d of win) { const v = (S.days[d] || {})[field]; if (v != null && v !== 0 && !map.has(d)) map.set(d, v); }
    return [...map.entries()].sort(([a], [b]) => (a < b ? -1 : 1));
  };
  const M = {
    weight: ["Weight", "kg", 1, () => series("weight", "weight"), "var(--m-body)", null],
    sleep: ["Sleep", "h", 1, () => series("sleepH", "sleepH"), "var(--m-habits)", S.settings.sleepTarget],
    deficit: ["Deficit", "kcal", 0, () => win.map((k) => [k, deficitOf(S.days[k])]).filter(([, v]) => v != null), "var(--ok)", S.settings.deficitMin],
    steps: ["Steps", "", 0, () => series("steps", "steps"), "var(--m-knowledge)", (S.settings.vitality || {}).steps],
    prayers: ["Prayers", "of 5", 1, () => logged.map((k) => [k, day(k).faith * 5]), "var(--m-faith)", 5],
    recovery: ["Recovery", "%", 0, () => series("recovery", "recovery"), "var(--ok)", 67],
    tasks: ["Tasks", "%", 0, () => logged.filter((k) => checklistFor(k).total).map((k) => [k, Math.round((checklistFor(k).frac || 0) * 100)]), "var(--gold)", 80],
  };
  const key = S.trend && M[S.trend] ? S.trend : "weight", [title, unit, digits, get, color, goal] = M[key], pts = get();
  return (
    <Section title="Trends" right={
      <div className="flex rounded-full bg-muted p-0.5">
        {RANGES.map(([n, l]) => <button key={n} onClick={() => { S.range = n; bump(); }} className={cn("press h-7 rounded-full px-2.5 text-[12px] font-semibold", days === n ? "bg-card shadow-sm" : "text-muted-foreground")}>{l}</button>)}
      </div>}>
      <div className="no-scrollbar -mx-4 mb-3 flex gap-1.5 overflow-x-auto px-4">
        {Object.entries(M).map(([k, [l]]) => (
          <button key={k} onClick={() => { S.trend = k; bump(); }} className={cn("press h-8 shrink-0 rounded-full px-3 text-[13px] font-medium", k === key ? "bg-foreground text-background" : "bg-muted text-muted-foreground")}>{l}</button>
        ))}
      </div>
      {pts.length ? <TrendChart points={pts} unit={unit} digits={digits} color={color} goal={goal || null} smooth={days > 60 ? 7 : 1} min={key === "weight" ? null : 0} />
        : <Hint className="py-8 text-center">No {title.toLowerCase()} data in the last {days} days yet.</Hint>}
    </Section>
  );
}
