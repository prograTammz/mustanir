// Progress: where you stand. Level and streaks, this month's council, the advisor, medals, trends and every measure.
import { useEffect, useState } from "react";
import { Crown, ChevronRight } from "lucide-react";
import { S, MINISTERS, today, addDays, range, diff, fmt, manual, day, totals, rankFor, RANKS, streak, bestStreak, T, medals, periods, score, verdict,
  termIndex, termInfo, checklistFor, deficitOf } from "@/lib/logic.js";
import { SESSION, loadHealth, saveSettings } from "@/lib/store.js";
import { useApp, bump } from "@/lib/app-state.js";
import { openSheet } from "@/components/sheets.jsx";
import { AdvisorCard } from "@/components/advisor.jsx";
import { Ar, Section, Hint, Fold, Bar, pctTxt } from "@/components/kit";
import { TrendChart } from "@/components/charts";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import Health from "./Health.jsx";

let healthLoading = false, healthFailedAt = 0;
export function useHealth() {
  useEffect(() => {
    if (S.health || healthLoading || !SESSION || Date.now() - healthFailedAt < 60000) return;
    healthLoading = true;
    loadHealth().then(() => { healthLoading = false; bump(); }).catch(() => { healthLoading = false; healthFailedAt = Date.now(); bump(); });
  }, []);
  return { loading: healthLoading, failed: !!healthFailedAt };
}

export default function Progress() {
  useApp();
  const hs = useHealth();
  return (
    <>
      <div className="px-1 pt-2 pb-1"><h1 className="text-[30px] leading-tight font-bold tracking-tight">Progress</h1></div>
      <Standing />
      <Council />
      <AdvisorCard full />
      <Medals />
      <Trends />
      <Card className="py-1"><CardContent>
        <Fold title="Body plan and every measure" summary="WHOOP history">
          <div className="-mx-4 flex flex-col gap-3 pt-1 pb-3 [&>[data-slot=card]]:rounded-none [&>[data-slot=card]]:border-x-0 [&>[data-slot=card]]:border-b-0"><Health hs={hs} /></div>
        </Fold>
      </CardContent></Card>
    </>
  );
}

/* ---------- level, rank, streaks ---------- */
function Standing() {
  const t = totals(), rank = rankFor(t.level), next = RANKS.find((r) => r.from > t.level);
  const ms = medals(), won = ms.filter((m) => m.won).length;
  const stats = [[streak(T.office), "day streak"], [bestStreak(T.office), "best streak"], [t.perfect, "perfect days"], [`${won}/${ms.length}`, "medals"]];
  return (
    <Card className="gap-4 px-4 py-4">
      <div className="flex items-center gap-4">
        <div className="relative grid size-16 shrink-0 place-items-center">
          <svg viewBox="0 0 24 24" className="absolute inset-0 size-full fill-gold"><path d="M12 2l2.4 4.2 4.7-1-1 4.7L22 12l-4.2 2.4 1 4.7-4.7-1L12 22l-2.4-4.2-4.7 1 1-4.7L2 12l4.2-2.4-1-4.7 4.7 1z" /></svg>
          <span className="relative text-[20px] font-bold text-[oklch(0.22_0.03_70)] tnum">{t.level}</span>
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[17px] font-semibold">{rank.en} <Ar className="ms-1 text-[15px] text-gold">{rank.ar}</Ar></div>
          <Bar className="mt-2" value={t.frac} color="var(--gold)" />
          <div className="mt-1.5 flex justify-between text-[12px] text-muted-foreground tnum">
            <span>{t.xp.toLocaleString("en")} XP</span><span>{(t.to - t.xp).toLocaleString("en")} to level {t.level + 1}</span>
          </div>
        </div>
      </div>
      <div className="grid grid-cols-4 gap-2">
        {stats.map(([v, l]) => (
          <div key={l} className="rounded-2xl bg-muted px-2 py-2.5 text-center">
            <div className="text-[18px] font-semibold tracking-tight tnum">{v}</div>
            <div className="text-[10.5px] leading-tight text-muted-foreground">{l}</div>
          </div>
        ))}
      </div>
      {next && <Hint>Next rank: {next.en} at level {next.from}.</Hint>}
    </Card>
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

/* ---------- medals ---------- */
function Medals() {
  const [all, setAll] = useState(false);
  const ms = medals(), won = ms.filter((m) => m.won), next = ms.filter((m) => !m.won);
  const shown = all ? [...won, ...next] : [...won, ...next].slice(0, Math.max(6, won.length));
  return (
    <Section title="Medals" right={<span className="text-[13px] text-muted-foreground tnum">{won.length} of {ms.length}</span>}>
      <div className="grid grid-cols-3 gap-2">
        {shown.map((m) => (
          <div key={m.id} className={cn("flex flex-col items-center gap-1 rounded-2xl px-2 py-3 text-center", m.won ? "bg-gold-soft" : "bg-muted")}>
            <Crown className={cn("size-5", m.won ? "text-gold" : "text-muted-foreground/40")} />
            <span className={cn("text-[12.5px] leading-tight font-semibold", !m.won && "text-muted-foreground")}>{m.en}</span>
            <span className="text-[10.5px] leading-tight text-muted-foreground">{m.how}</span>
          </div>
        ))}
      </div>
      {ms.length > shown.length || all ? (
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
      {pts.length ? <TrendChart id={"t-" + key} points={pts} unit={unit} digits={digits} color={color} goal={goal || null} smooth={days > 60 ? 7 : 1} min={key === "weight" ? null : 0} />
        : <Hint className="py-8 text-center">No {title.toLowerCase()} data in the last {days} days yet.</Hint>}
    </Section>
  );
}
